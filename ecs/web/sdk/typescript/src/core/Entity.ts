import { PublicKey } from '@solana/web3.js';

export class Entity {
    private id: string;
    private components: Map<string, any>;
    private publicKey: PublicKey; 
    constructor(id: string, publicKey: PublicKey) {
        this.id = id;
        this.components = new Map();
        this.publicKey = publicKey;
    }

    public getId(): string {
        return this.id;
    }

    public getPublicKey(): PublicKey {
        return this.publicKey;
    }

    public addComponent<T>(componentType: string, data: T): void {
        this.components.set(componentType, data);
    }

    public getComponent<T>(componentType: string): T | undefined {
        return this.components.get(componentType) as T;
    }

    public hasComponent(componentType: string): boolean {
        return this.components.has(componentType);
    }

    public removeComponent(componentType: string): boolean {
        return this.components.delete(componentType);
    }

    public getComponents(): Map<string, any> {
        return new Map(this.components); 
    }
} 