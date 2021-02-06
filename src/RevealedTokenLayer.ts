import { MODULE_NAME, SettingName } from "./settings.js";
import { getSocket, SOCKET_EVENT_NAME, TokenVisibilityUpdate } from "./sockets.js";

const PROXIED_TOKEN_KEY = Symbol("ProxiedToken");
type ProxiableToken = Token & { [PROXIED_TOKEN_KEY]?: { visible: boolean } };

/**
 * A special CanvasLayer that exists solely to render itself on
 * top of the SightLayer, to reveal tokens under certain criteria.
 */
export class RevealedTokenLayer extends CanvasLayer {
    // Map of token IDs to the users who can see them
    readonly revealedTokens: Map<string, Set<string>>;

    // Between updates, track which token IDs this person can
    // see or not see according to vanilla Foundry behavior.
    readonly myVisibleTokens: Set<string>;
    readonly myHiddenTokens: Set<string>;

    // User-controlled tokens that have been manually hidden by this module
    // to reveal in this layer. Maps token IDs to the token and original alpha value.
    readonly hiddenControlledTokens: Map<string, [ProxiableToken, number]>;

    readonly layerTokens: Map<string, ProxiableToken>;

    pendingUpdates = 0;

    constructor() {
        super();
        this.revealedTokens = new Map();
        this.myVisibleTokens = new Set();
        this.myHiddenTokens = new Set();
        this.hiddenControlledTokens = new Map();
        this.layerTokens = new Map();
    }

    static get layerOptions(): CanvasLayerOptions {
        return mergeObject(SightLayer.layerOptions, {
            zIndex: SightLayer.layerOptions.zIndex + 1,
        } as CanvasLayerOptions);
    }

    get tokens(): Token[] {
        return [...this.layerTokens.values()];
    }

    /**
     * Handles repopulating our layer with token icons and pushing visibility
     * changes to other clients.
     */
    async rebuildLayer(sight: SightLayer): Promise<void> {
        this.pendingUpdates++;
        const updateSnapshot = this.pendingUpdates;

        if (!sight.tokenVision || !sight.sources.size) {
            // This module is a no-op without token vision.
            this.visible = false;
            this.releaseAllTokens();
            this.revealedTokens.clear();
            this.myVisibleTokens.clear();
            this.myHiddenTokens.clear();
            this.pendingUpdates = 0;
            return;
        }

        // Sets for tracking changes from the previous update.
        // If any token changes, we'll need to notify other clients
        // so that they can repaint.
        const newlyVisible = new Set<string>();
        const newlyHidden = new Set<string>();

        // Whether NPCs (versus just players) are eligible to have revealed tokens
        const canRevealNpcs = !!game.settings.get(MODULE_NAME, SettingName.RevealNpc);

        // We'll iterate all tokens on the canvas and determine if we should
        // see them.
        const newChildren: PIXI.Container[] = [];
        for (const token of canvas.tokens.placeables as ProxiableToken[]) {
            // First - evaluate whether this token is newly visible or hidden from *this* client's
            // perspective. This is used to synchronize state between clients.
            if (token.id) {
                if (token.visible && !this.myVisibleTokens.has(token.id)) {
                    this.myHiddenTokens.delete(token.id);
                    this.myVisibleTokens.add(token.id);
                    newlyVisible.add(token.id);
                } else if (!token.visible && !this.myHiddenTokens.has(token.id)) {
                    this.myVisibleTokens.delete(token.id);
                    this.myHiddenTokens.add(token.id);
                    newlyHidden.add(token.id);
                }
            }

            // Next we'll figure out if this token is currently invisible on our TokenLayer,
            // and should be revealed on this layer.
            if (!token.visible && !token.data.hidden) {
                // If this token has been hidden by a visibility restriction,
                // evaluate whether draw it on this layer.

                // We always flag other players as visible
                const isAnotherPlayer = !!token.actor?.hasPlayerOwner;
                const isRevealed = (this.revealedTokens.get(token.id)?.size ?? 0) > 0;
                if (!isAnotherPlayer && (!isRevealed || !canRevealNpcs)) {
                    // If it's not a player, we require at least one player to have revealed
                    // this token to us.
                    continue;
                }

                // Reveal the token
                newChildren.push(await this.buildTokenContainer(token));
            } else if (token.visible && token._controlled) {
                const shouldReveal = !!game.settings.get(MODULE_NAME, SettingName.RevealControlled);
                if (shouldReveal) {
                    // We want to special-case tokens controlled by the current user to account
                    // for situations where they might not be playing with 360 degree vision.
                    newChildren.push(await this.buildTokenContainer(token, { alpha: 1 }));
                    if (!this.hiddenControlledTokens.has(token.id)) {
                        this.hiddenControlledTokens.set(token.id, [token, token.alpha]);
                    }

                    // TODO: Reevaluate
                    // token.alpha = 0;
                } else {
                    // If this token shouldn't be revealed but we did in a previous pass,
                    // restore the original data.
                    const originalData = this.hiddenControlledTokens.get(token.id);
                    if (originalData) {
                        // const [origToken, origAlpha] = originalData;

                        // TODO: Reevaluate
                        // origToken.alpha = origAlpha;
                        this.hiddenControlledTokens.delete(token.id);
                    }
                }
            }
        }

        // If anything changed since the last update, notify other clients.
        if (newlyVisible.size > 0 || newlyHidden.size > 0) {
            this.emitVisibilityUpdate();
        }

        // If this happens, another update got queued while
        // we were stuck doing something async. We'll cancel
        // and let the new update take over.
        if (this.pendingUpdates !== updateSnapshot) {
            this.pendingUpdates = Math.max(0, this.pendingUpdates - 1);
            // return;
        }

        this.removeChildren();
        for (const newChild of newChildren) {
            // TODO
            this.addChild(newChild);
        }

        this.visible = true;
        this.pendingUpdates--;
    }

    /**
     * Builds the icon component of a token as a PIXI Sprite.
     * Based on Token._drawIcon().
     */
    buildTokenIcon(
        token: ProxiableToken & { texture?: PIXI.Texture }
    ): { sprite: PIXI.Sprite; texture?: PIXI.Texture } {
        const icon = new PIXI.Sprite(token.texture);
        icon.anchor.set(0.5, 0.5);
        if (!token.texture) {
            return { sprite: icon };
        }

        icon.tint = token.data.tint ? colorStringToHex(token.data.tint) : 0xffffff;
        return { sprite: icon, texture: token.texture };
    }

    /**
     * Given a Token, clones it as a new PIXI Container for rendering into this layer.
     */
    async buildTokenContainer(
        token: ProxiableToken,
        { alpha = 0.5 }: { alpha?: number } = {}
    ): Promise<PIXI.Container> {
        if (!token[PROXIED_TOKEN_KEY]) {
            token[PROXIED_TOKEN_KEY] = { visible: token.visible };
            Object.defineProperty(token, "visible", {
                configurable: true,
                get: () => {
                    return true;
                },
                set: (value: boolean) => {
                    const proxyData = token[PROXIED_TOKEN_KEY];
                    if (proxyData) {
                        proxyData.visible = value;
                    }
                },
            });
        }

        // token.visible = true;
        this.layerTokens.set(token.id, token);
        return token;

        /*
        const tokenClone = token.clone();
        await tokenClone.draw();

        // Tokens hide themselves in the draw() method by default
        tokenClone.visible = true;

        // Revealed tokens will be at 50% opacity by default, but can be overridden
        tokenClone.alpha = alpha;

        return tokenClone;
        */
    }

    releaseAllTokens(): void {
        for (const [token] of this.hiddenControlledTokens.values()) {
            this.releaseToken(token);
        }

        for (const id of this.revealedTokens.keys()) {
            this.releaseTokenById(id);
        }

        for (const id of this.myHiddenTokens.keys()) {
            this.releaseTokenById(id);
        }

        for (const id of this.myVisibleTokens.keys()) {
            this.releaseTokenById(id);
        }
    }

    releaseTokenById(id: string): void {
        const token = this.layerTokens.get(id);
        if (token) {
            this.releaseToken(token as ProxiableToken);
        }
    }

    releaseToken(token: ProxiableToken): void {
        if (token[PROXIED_TOKEN_KEY]) {
            Object.defineProperty(token, "visible", {
                configurable: true,
                writable: true,
                value: token[PROXIED_TOKEN_KEY]?.visible,
            });
            delete token[PROXIED_TOKEN_KEY];
        }

        this.layerTokens.delete(token.id);
    }

    /**
     * Handles visibility updates from other clients.
     */
    handleTokenUpdate({ userId, visibleIds, hiddenIds }: TokenVisibilityUpdate): void {
        let dirty = false;
        for (const visible of visibleIds) {
            if (!this.revealedTokens.has(visible)) {
                this.revealedTokens.set(visible, new Set());
            }
            this.revealedTokens.get(visible)?.add(userId);

            // Did we just reveal this token for the first time?
            if (this.revealedTokens.get(visible)?.size === 1) {
                dirty = true;
            }
        }

        for (const hidden of hiddenIds) {
            this.revealedTokens.get(hidden)?.delete(userId);

            // Did we just lose track of this token?
            if (this.revealedTokens.get(hidden)?.size === 0) {
                dirty = true;
            }
        }

        if (dirty) {
            this.rebuildLayer(canvas.sight);
        }
    }

    /**
     * Notifies the layer that one or more tokens have been deleted,
     * so that they can be removed from this layer if needed.
     */
    deleteTokens(ids: string[]): void {
        let dirty = false;
        for (const id of ids) {
            if (this.revealedTokens.delete(id)) {
                dirty = true;
            }

            this.myHiddenTokens.delete(id);
            this.myVisibleTokens.delete(id);
        }

        if (dirty) {
            this.rebuildLayer(canvas.sight);
        }
    }

    /**
     * Notifies the layer that one or more tokens have been updated,
     * so that this layer can refresh itself if needed. This helps keep
     * us in sync as tokens move around or have properties change.
     */
    updateTokens(_userId: string, updates: Array<{ _id: string }>): void {
        let dirty = false;
        for (const { _id: tokenId } of updates) {
            const visibleToOtherPlayer = this.revealedTokens.has(tokenId) && !this.myVisibleTokens.has(tokenId);
            const visibleToMe = this.myVisibleTokens.has(tokenId);
            if (visibleToOtherPlayer || visibleToMe) {
                dirty = true;
                break;
            }
        }

        if (dirty) {
            this.rebuildLayer(canvas.sight);
        }
    }

    /**
     * Fires off the current visibility status to other clients.
     */
    emitVisibilityUpdate(): void {
        const update: TokenVisibilityUpdate = {
            type: "visibilityUpdate",
            userId: game.userId,
            visibleIds: [...this.myVisibleTokens],
            hiddenIds: [...this.myHiddenTokens],
        };

        getSocket().emit(SOCKET_EVENT_NAME, update);
    }
}
