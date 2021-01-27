declare class Token extends PlaceableObject {
    actor: Actor | undefined;
    hasSight: boolean;
    _isVisionSource(): boolean;
}
