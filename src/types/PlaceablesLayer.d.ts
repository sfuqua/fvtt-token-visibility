declare class PlaceablesLayer<T extends PlaceableObject> extends CanvasLayer {
    readonly placeables: T[];
    objects: PIXI.Container | null;

    get controlled(): T[];

    /**
     * Draw the PlaceablesLayer.
     * Draw each Sound within the scene as a child of the sounds container.
     */
    draw(): Promise<PlaceablesLayer>;

    /**
     * Draw a single placeable object
     */
    createObject(data: unknown): T;

    /**
     * Tries to find an object on this layer.
     */
    get(id: string): T | undefined;
}
