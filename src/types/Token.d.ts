declare class Token extends PlaceableObject {
    actor: Actor | undefined;
    hasSight: boolean;
    get _controlled(): boolean;
    _isVisionSource(): boolean;
}
