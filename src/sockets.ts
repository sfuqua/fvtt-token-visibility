import { MODULE_NAME } from "./settings.js";

/**
 * The Foundry server will only broadcast events if:
 * 1. We opt into sockets via the module manifest
 * 2. Our event name is `module.${module_name}`
 */
export const SOCKET_EVENT_NAME = `module.${MODULE_NAME}`;

/**
 * Asks other clients for their visibility info.
 * Used to sync during initial load.
 */
export type VisibilityRequest = {
    type: "visibilityRequest";

    /**
     * The sending user.
     */
    userId: string;
};

/**
 * Provides the current visibility to other users.
 */
export type TokenVisibilityUpdate = {
    type: "visibilityUpdate";

    /**
     * The sending user.
     */
    userId: string;

    /**
     * Token IDs that are now visible.
     */
    visibleIds: string[];

    /**
     * Token IDs that are now hidden.
     */
    hiddenIds: string[];
};

export type SocketEvent = VisibilityRequest | TokenVisibilityUpdate;

export type EmbeddedEntityUpdateCommon = {
    /**
     * The user initiating the update request.
     */
    userId: string;
};

export type EmbeddedEntityCreateRequest = {
    request: { action: "create" };
    result: unknown;
};

/**
 * Entities getting deleted from another client.
 */
export type EmbeddedEntityDeleteRequest = {
    request: {
        action: "delete";
        type: string;
        data: string[];
    };

    /**
     * Deleted entity IDs.
     */
    result: string[];
};

/**
 * Entities getting updated from another client.
 */
export type EmbeddedEntityUpdateRequest = {
    request: {
        action: "update";
        type: string;
        data: Array<{ _id: string }>;
    };

    /**
     * Committed updates.
     */
    result: Array<{ _id: string }>;
};

export type EmbeddedEntityUpdate = EmbeddedEntityUpdateCommon &
    (EmbeddedEntityCreateRequest | EmbeddedEntityDeleteRequest | EmbeddedEntityUpdateRequest);

export function getSocket(): SocketIOClient.Socket {
    return game.socket as SocketIOClient.Socket;
}
