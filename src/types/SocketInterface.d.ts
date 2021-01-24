declare class SocketInterface {
    static dispatch(eventName: string, payload: unknown): Promise<void>;
}
