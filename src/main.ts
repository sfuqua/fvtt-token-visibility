/**
 * The goal of this module is to reveal (to all players) any hidden tokens as long as:
 * 1. They have a token on the scene themselves, so they can see *smomething*
 * 2. One of their allies in the party has visibility of the token
 *
 * OPTION A: leverage `restrictVisibility` and the "sightRefresh" hook
 * The SightLayer is a CanvasLayer that calls `restrictVisibility` to hide tokens (and door controls) from players.
 * At the end of this function the "sightRefresh" hook is dispatched.
 * We could leverage this hook and re-enable invisible tokens as long as at least one player can see the token.
 * Hooks.on("sightRefresh", layer => {
 *   // Enumerate canvas.tokens.placeables
 *   // canvas seems to be a global; canvas.tokens is the TokenLayer; placeables is a Token[]
 *   // if !token.visible, token.visible = isTokenVisibleToAnyPlayer(v)? This function does not exist yet
 * });
 *
 * This approach involves multiple passes over the token collection and can be inefficient for token-heavy scenes.
 *
 * OPTION B: leverage token.isVisible
 * If we get this to true for a player, then restrictVisibility will ignore the token.
 * This relies on the "get isVisible" property on the Token class in foundry.js, which calls:
 * canvas.sight.testVisibility(this.center, {tolerance, object: this});
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

function getRevealedTokenLayer(): RevealedTokenLayer | undefined {
    return ((canvas as unknown) as { [key: string]: RevealedTokenLayer })?.[REVEALED_TOKEN_LAYER_KEY];
}

CONFIG.debug.hooks = true;

Hooks.on("init", () => {
    // TODO: Register settings

    // Add our custom layer to the list of Canvas layers.
    // We want to ensure this happens before the Canvas is constructed.
    // The init hook should happen first, giving us a chance to tamper with layers
    // before Canvas._createLayers is called.
    const currentLayers = Canvas[CANVAS_LAYERS_KEY];
    const newLayers = { ...currentLayers, [REVEALED_TOKEN_LAYER_KEY]: RevealedTokenLayer };
    Object.defineProperty(Canvas, CANVAS_LAYERS_KEY, { get: () => newLayers });
});

Hooks.on("setup", () => {
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

Hooks.on(
    "updateToken",
    (_scene: Scene, token: { _id: string }, _update: unknown, _options: unknown, userId: string) => {
        const ourLayer = getRevealedTokenLayer();
        ourLayer?.updateTokens(userId, [token]);
    }
);

Hooks.on("deleteToken", (_scene: Scene, token: { _id: string }, _options: unknown, userId: string) => {
    const ourLayer = getRevealedTokenLayer();
    ourLayer?.deleteTokens([token._id]);
});
