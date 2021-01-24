export const SOCKET_EVENT_NAME = "module.shared-token-visibility";

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
