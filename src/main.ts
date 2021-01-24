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
import { getSocket, SOCKET_EVENT_NAME, TokenVisibilityUpdate } from "./sockets.js";

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

Hooks.on("init", () => {
    // TODO: Register settings
    // It'd be nice to have a setting for "all tokens" vs "just players"

    // Add our custom layer to the list of Canvas layers.
    // We want to ensure this happens before the Canvas is constructed.
    // The init hook should happen first, giving us a chance to tamper with layers
    // before Canvas._createLayers is called.
    const currentLayers = Canvas[CANVAS_LAYERS_KEY];
    const newLayers = { ...currentLayers, [REVEALED_TOKEN_LAYER_KEY]: RevealedTokenLayer };
    Object.defineProperty(Canvas, CANVAS_LAYERS_KEY, { get: () => newLayers });
});

Hooks.on("setup", () => {
    // This module uses the game websocket to notify other clients of token visibility updates
    // This hook handles responding to that event
    const socket = getSocket();

    // When we get a visibility update event from another client, find our layer instance
    // on the current canvas and try to notify it of the change.
    socket.on(SOCKET_EVENT_NAME, (event: TokenVisibilityUpdate) => {
        if (event.userId === game.userId) {
            return;
        }

        const ourLayer = getRevealedTokenLayer();
        if (event.type === "visibilityUpdate") {
            ourLayer?.handleTokenUpdate(event);
        }
    });
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
