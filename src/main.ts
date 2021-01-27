/**
 * The goal of this module is to reveal (to all players) any hidden tokens as long as:
 * 1. They have a token on the scene themselves, so they can see *smomething*
 * 2. One of their allies in the party has visibility of the token
 *
 * To accomplish this, we do the following:
 * 1. Establish a new CanvasLayer ("RevealedTokenLayer") that renders above the SightLayer, so that
 *      revealed tokens draw above the fog of war
 * 2. Leverage the "sightRefresh" hook to keep token visibility state in sync between clients, using the socket.
 * 3. As tokens are updated or we get notified about visibility changes from other clients, update our new layer.
 */

import { RevealedTokenLayer } from "./RevealedTokenLayer.js";
import { loc } from "./loc.js";
import { MODULE_NAME, SettingName } from "./settings.js";
import { getSocket, SocketEvent, SOCKET_EVENT_NAME, VisibilityRequest } from "./sockets.js";

// Ideally this would be a Symbol to avoid conflicts, but Foundry
// relies on Object.keys to walk the named layers, which is strings only.
const REVEALED_TOKEN_LAYER_KEY = "revealedTokens";

/**
 * The Foundry Canvas property that identifies the predefined list of layers.
 */
const CANVAS_LAYERS_KEY = "layers";

/**
 * Helper to fish our layer out of the canvas.
 * @returns The RevealedTokenLayer if it exists, else undefined
 */
function getRevealedTokenLayer(): RevealedTokenLayer | undefined {
    return ((canvas as unknown) as { [key: string]: RevealedTokenLayer })?.[REVEALED_TOKEN_LAYER_KEY];
}

CONFIG.debug.hooks = true;

Hooks.on("init", () => {
    game.settings.register(MODULE_NAME, SettingName.RevealNpc, {
        name: loc("Setting.RevealNpc.Title"),
        hint: loc("Setting.RevealNpc.Hint"),
        type: Boolean,
        config: true,
        default: true,
        scope: "world",
        onChange: (newValue: boolean) => {
            console.log(`[${MODULE_NAME}]: NPC reveal setting changed to ${newValue}, reevaluating visibility`);
            const ourLayer = getRevealedTokenLayer();
            ourLayer?.rebuildLayer(canvas.sight);
        },
    });

    game.settings.register(MODULE_NAME, SettingName.PlayerVision, {
        name: loc("Setting.PlayerVision.Title"),
        hint: loc("Setting.PlayerVision.Hint"),
        type: Boolean,
        config: true,
        default: false,
        scope: "world",
        onChange: (newValue: boolean) => {
            console.log(`[${MODULE_NAME}]: Player vision setting changed to ${newValue}, reevaluating canvas sources`);
            canvas.initializeSources();
        },
    });

    // Add our custom layer to the list of Canvas layers.
    // We want to ensure this happens before the Canvas is constructed.
    // The init hook should happen first, giving us a chance to tamper with layers
    // before Canvas._createLayers is called.
    const currentLayers = Canvas[CANVAS_LAYERS_KEY];
    const newLayers = { ...currentLayers, [REVEALED_TOKEN_LAYER_KEY]: RevealedTokenLayer };
    Object.defineProperty(Canvas, CANVAS_LAYERS_KEY, { get: () => newLayers });

    // Monkeypatch Token._isVisionSource() to allow our custom token vision behavior, if
    // the user has opted into sharing player vision.
    const originalIsVisionSource = Token.prototype._isVisionSource;
    Token.prototype._isVisionSource = function (this: Token) {
        const sharePlayerVision = !!game.settings.get(MODULE_NAME, SettingName.PlayerVision);

        const controlledTokens = (this.layer.controlled as Token[]).filter((t) => !t.data.hidden && t.hasSight);

        // We add this token as a vision source if:
        // 1. The setting is enabled
        // 2. All controlled tokens are owned by a player
        // 3. This token is owned by a player
        return (
            originalIsVisionSource.call(this) ||
            (sharePlayerVision &&
                controlledTokens.length > 0 &&
                controlledTokens.reduce((acc, tok) => acc && !!tok.actor?.hasPlayerOwner, true) &&
                !!this.actor?.hasPlayerOwner)
        );
    };
});

Hooks.on("setup", () => {
    // This module uses the game websocket to notify other clients of token visibility updates
    // This hook handles responding to that event
    const socket = getSocket();

    // When we get a visibility update event from another client, find our layer instance
    // on the current canvas and try to notify it of the change.
    socket.on(SOCKET_EVENT_NAME, (event: SocketEvent) => {
        // Ignore socket updates from ourselves
        if (event.userId === game.userId) {
            return;
        }

        const ourLayer = getRevealedTokenLayer();

        switch (event.type) {
            case "visibilityRequest": {
                ourLayer?.emitVisibilityUpdate();
                break;
            }
            case "visibilityUpdate": {
                ourLayer?.handleTokenUpdate(event);
                break;
            }
            default: {
                const unexpectedEvent: never = event;
                console.warn(`[${MODULE_NAME}]: Unexpected websocket event: ${JSON.stringify(unexpectedEvent)}`);
            }
        }
    });
});

Hooks.on("ready", () => {
    // Once we're done loading, ask other clients to sync their
    // visibility to us.
    const visibilityRequest: VisibilityRequest = {
        type: "visibilityRequest",
        userId: game.userId,
    };
    getSocket().emit(SOCKET_EVENT_NAME, visibilityRequest);
});

// The sightRefresh hook is invoked by the SightLayer once
// it has finished updating token visibility based on fog.
// We'll want to rebuild our reveal layer and then push updates to
// other clients.
Hooks.on("sightRefresh", (sight: SightLayer) => {
    const ourLayer = getRevealedTokenLayer();
    ourLayer?.rebuildLayer(sight);
});

// Whenever we get notified about a token update, evaluate whether our layer is dirty
Hooks.on(
    "updateToken",
    (_scene: Scene, token: { _id: string }, _update: unknown, _options: unknown, userId: string) => {
        const ourLayer = getRevealedTokenLayer();
        ourLayer?.updateTokens(userId, [token]);
    }
);

// Whenever we notified about a token being deleted, evaluate whether our layer is dirty
Hooks.on("deleteToken", (_scene: Scene, token: { _id: string }, _options: unknown, userId: string) => {
    const ourLayer = getRevealedTokenLayer();
    ourLayer?.deleteTokens([token._id]);
});
