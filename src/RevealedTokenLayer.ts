import { MODULE_NAME, SettingName } from "./settings.js";
import { getSocket, SOCKET_EVENT_NAME, TokenVisibilityUpdate } from "./sockets.js";

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

    constructor() {
        super();
        this.revealedTokens = new Map();
        this.myVisibleTokens = new Set();
        this.myHiddenTokens = new Set();
    }

    static get layerOptions(): CanvasLayerOptions {
        return mergeObject(SightLayer.layerOptions, {
            zIndex: SightLayer.layerOptions.zIndex + 1,
        } as CanvasLayerOptions);
    }

    /**
     * Handles repopulating our layer with token icons and pushing visibility
     * changes to other clients.
     */
    async rebuildLayer(sight: SightLayer): Promise<void> {
        if (!sight.tokenVision || !sight.sources.size) {
            // This module is a no-op without token vision.
            this.visible = false;
            this.revealedTokens.clear();
            this.myVisibleTokens.clear();
            this.myHiddenTokens.clear();
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
        for (const token of canvas.tokens.placeables as Token[]) {
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
                newChildren.push(await this.buildTokenContainer(token as Token));
            }
        }

        this.removeChildren();
        for (const newChild of newChildren) {
            this.addChild(newChild);
        }

        // If anything changed since the last update, notify other clients.
        if (newlyVisible.size > 0 || newlyHidden.size > 0) {
            this.emitVisibilityUpdate();
        }

        this.visible = true;
    }

    /**
     * Builds the icon component of a token as a PIXI Sprite.
     * Based on Token._drawIcon().
     */
    buildTokenIcon(token: Token & { texture?: PIXI.Texture }): { sprite: PIXI.Sprite; texture?: PIXI.Texture } {
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
    async buildTokenContainer(token: Token): Promise<PIXI.Container> {
        const tokenClone = token.clone();
        await tokenClone.draw();

        // Tokens hide themselves in the draw() method by default
        tokenClone.visible = true;

        // Revealed tokens will be at 50% opacity
        tokenClone.alpha = 0.5;

        return tokenClone;
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
     * us in sync as tokens move around.
     */
    updateTokens(_userId: string, updates: Array<{ _id: string }>): void {
        let dirty = false;
        for (const { _id: tokenId } of updates) {
            // This means we have shared vision of this token and aren't drawing it ourselves,
            // so the token needs to move
            if (this.revealedTokens.has(tokenId) && !this.myVisibleTokens.has(tokenId)) {
                dirty = true;
                break;
            }

            // Whether this token is currently being drawn on this client
            const tokenVisible = canvas.tokens.get(tokenId)?.visible;

            // This means something's out of sync and we need to rebuild our status
            if (
                !!tokenVisible !== this.myVisibleTokens.has(tokenId) ||
                !tokenVisible !== this.myHiddenTokens.has(tokenId)
            ) {
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
        // If we're a GM, we want to avoid leaking tokens to the players
        if (game.user.isGM) {
            return;
        }

        const update: TokenVisibilityUpdate = {
            type: "visibilityUpdate",
            userId: game.userId,
            visibleIds: [...this.myVisibleTokens],
            hiddenIds: [...this.myHiddenTokens],
        };

        getSocket().emit(SOCKET_EVENT_NAME, update);
    }
}
