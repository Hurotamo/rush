import { Connection, PublicKey, Keypair, Transaction, SystemProgram, sendAndConfirmTransaction, TransactionInstruction } from '@solana/web3.js';
import { World } from './core/World';
import { StoragePort } from './storage/StoragePort';
import { SolanaStorageAdapter } from './storage/SolanaStorageAdapter';
import { Entity } from './core/Entity';
import { SystemPort } from './core/SystemPort';
import { IBluePrint, ComponentSchema } from './types/types';
import * as fs from 'fs';
import { SessionAuth } from './modules/session/session';
import { Auth as AuthPort } from './modules/session/adapters/auth-adapter';

// Define a more specific error class for SDK errors
export class SDKError extends Error {
    constructor(message: string, public cause?: any) {
        super(message);
        this.name = 'SDKError';
    }
}

// Placeholder for deserialized account data. Adapt to your on-chain structure.
interface OnChainEntityData {
    id: string;
    owner: string; // string representation of PublicKey
    components: Record<string, any>; 
}

export class RushSDK {
    private world: World;
    private storage: StoragePort;
    private wallet: Keypair | null;
    private blueprint: IBluePrint | null;
    private sessionAuth: AuthPort;
    private userWalletPublicKey: PublicKey | null;
    private activeSessionKeypair: Keypair | null;

    constructor(connection: Connection, programId: PublicKey, blueprintPath?: string) {
        this.world = new World();
        this.storage = new SolanaStorageAdapter(connection, programId);
        this.sessionAuth = new SessionAuth(connection);
        this.wallet = null;
        this.blueprint = null;
        this.userWalletPublicKey = null;
        this.activeSessionKeypair = null;

        if (blueprintPath) {
            this.loadBlueprint(blueprintPath);
        }
    }

    private loadBlueprint(blueprintPath: string): void {
        try {
            // TODO: Implement more robust blueprint loading and validation
            // This is a placeholder assuming the blueprint is a JSON file.
            const rawData = fs.readFileSync(blueprintPath, 'utf-8');
            this.blueprint = JSON.parse(rawData) as IBluePrint;
            // Basic validation:
            if (!this.blueprint || !this.blueprint.name || !this.blueprint.entities) {
                throw new Error('Invalid blueprint structure.');
            }
            console.log(`Blueprint "${this.blueprint.name}" loaded successfully.`);
        } catch (error) {
            throw new SDKError(`Failed to load blueprint from ${blueprintPath}`, error);
        }
    }

    /**
     * Sets the primary wallet Keypair for SDK operations when not using a session.
     * This wallet will be used if no active session is present.
     */
    public setPrimaryWallet(wallet: Keypair): void {
        this.wallet = wallet;
        this.userWalletPublicKey = wallet.publicKey;
        this.activeSessionKeypair = null;
        console.log(`Primary wallet set: ${wallet.publicKey.toBase58()}`);
    }

    /**
     * Determines the active payer (Keypair) for transactions.
     * Prefers an active session keypair, falls back to the primary wallet.
     */
    private getActivePayer(): Keypair {
        if (this.activeSessionKeypair) {
            console.log("Using active session keypair as payer.");
            return this.activeSessionKeypair;
        }
        if (this.wallet) {
            console.log("Using primary wallet as payer.");
            return this.wallet;
        }
        throw new SDKError('No active payer wallet found. Set a primary wallet or create and activate a session.');
    }
    
    // --- Session Management Methods ---

    /**
     * Connects to the user's Solana wallet (e.g., Phantom) and stores their public key.
     * This does not provide a Keypair for signing, only the PublicKey.
     */
    public async connectUserWallet(): Promise<PublicKey> {
        try {
            this.userWalletPublicKey = await this.sessionAuth.connectWallet();
            console.log(`User wallet connected: ${this.userWalletPublicKey.toBase58()}`);
            return this.userWalletPublicKey;
        } catch (error) {
            throw new SDKError("Failed to connect user wallet", error);
        }
    }

    /**
     * Creates a new encrypted session key, managed by SessionAuth.
     * @param sessionData Arbitrary data to associate with the session, used for deriving encryption keys.
     * @returns The encrypted session keypair string (base64). This string is the handle to the session.
     */
    public createUserSession<T>(sessionData: T): string {
        try {
            const encryptedSessionKey = this.sessionAuth.createSession(sessionData);
            console.log("User session created. Encrypted session key generated.");
            return encryptedSessionKey;
        } catch (error) {
            throw new SDKError("Failed to create user session", error);
        }
    }

    /**
     * Activates a session for SDK operations by providing the decrypted session Keypair.
     * This makes the session keypair the active payer for SDK-initiated transactions.
     * @param sessionKeypair The decrypted Keypair for the session.
     */
    public activateSessionKeypair(sessionKeypair: Keypair): void {
        this.activeSessionKeypair = sessionKeypair;
        this.wallet = sessionKeypair;
        console.log(`Session activated with keypair: ${sessionKeypair.publicKey.toBase58()}`);
    }

    /**
     * Deactivates the current session keypair, falling back to the primary wallet if set.
     */
    public deactivateSession(): void {
        console.log(`Deactivating session keypair: ${this.activeSessionKeypair?.publicKey.toBase58()}`);
        this.activeSessionKeypair = null;
        this.wallet = null;
        console.log("Session deactivated. SDK will use primary wallet if set, or require a new session/wallet.");
    }

    /**
     * Placeholder to attempt to decrypt a session key using SessionAuth's logic.
     * Requires SessionAuth.decrypt (or similar) to be accessible.
     */
    public decryptSessionKey<T>(encryptedSessionKey: string, sessionDataForDecryption: T): Keypair {
        if (!(this.sessionAuth as any).decrypt) {
            throw new SDKError('SessionAuth.decrypt method is not accessible. Cannot decrypt session key within RushSDK.');
        }
        try {
            return (this.sessionAuth as any).decrypt(encryptedSessionKey, sessionDataForDecryption);
        } catch (error) {
            throw new SDKError("Failed to decrypt session key via SessionAuth", error);
        }
    }

    /**
     * Validates an encrypted session key using SessionAuth.
     */
    public validateUserSession(encryptedSessionKeypair: string): boolean {
        try {
            return this.sessionAuth.validateSession(encryptedSessionKeypair);
        } catch (error) {
            console.error("Error validating user session:", error);
            return false;
        }
    }

    /**
     * Adds funds to a session. The user's main wallet (e.g., Phantom) will be prompted to sign.
     */
    public async addFundsToSession(amount: number, encryptedSessionKeypair: string): Promise<void> {
        if (!this.userWalletPublicKey) {
            throw new SDKError("User wallet not connected. Cannot determine fund sender.");
        }
        try {
            // SessionAuth.addFunds internally calls connectWallet again if userPublicKey is not set.
            // It uses window.solana to sign.
            await this.sessionAuth.addFunds(amount, encryptedSessionKeypair, this.userWalletPublicKey);
        } catch (error) {
            throw new SDKError("Failed to add funds to session", error);
        }
    }

    /**
     * Refunds remaining funds from a session to the connected user's main wallet.
     */
    public async refundSessionFunds(encryptedSessionKeypair: string): Promise<void> {
        if (!this.userWalletPublicKey) {
            throw new SDKError("User wallet not connected. Cannot determine refund recipient for session.");
        }
        try {
            await this.sessionAuth.refundFunds(this.userWalletPublicKey, encryptedSessionKeypair);
            console.log("Refund session funds request processed.");
        } catch (error) {
            throw new SDKError("Failed to refund session funds", error);
        }
    }

    /**
     * Revokes a session: refunds funds and clears session storage.
     */
    public revokeUserSession(encryptedSessionKeypair: string): void {
        try {
            this.sessionAuth.revokeSession(encryptedSessionKeypair);
            console.log("Revoke user session request processed.");
            if (this.activeSessionKeypair) {
                this.deactivateSession();
            }
        } catch (error) {
            throw new SDKError("Failed to revoke user session", error);
        }
    }
    
    /**
     * Creates a simple transfer transaction using an active session key.
     * The session must be funded and valid.
     */
    public async createTransactionWithSession(amount: number, encryptedSessionKeypair: string, recipient: PublicKey): Promise<void> {
        try {
            await this.sessionAuth.createTransaction(amount, encryptedSessionKeypair, recipient);
            console.log("Create transaction with session request processed.");
        } catch (error) {
            throw new SDKError("Failed to create transaction with session", error);
        }
    }

    public setWallet(wallet: Keypair): void {
        console.warn("setWallet is called. Consider using setPrimaryWallet or activateSessionKeypair for clarity with session management.");
        this.wallet = wallet;
        if (!this.userWalletPublicKey || this.userWalletPublicKey.toBase58() !== wallet.publicKey.toBase58()) {
            this.userWalletPublicKey = wallet.publicKey;
        }
        this.activeSessionKeypair = null;
    }

    public getWorld(): World {
        return this.world;
    }

    public getStorage(): StoragePort {
        return this.storage;
    }

    public async createEntity(components: Record<string, any> = {}): Promise<Entity> {
        const payer = this.getActivePayer(); // Use active payer

        // For on-chain entities, the public key might be derived or a new Keypair generated for its account
        const entityAccount = Keypair.generate(); // This account would store the entity's data on-chain
        const entityId = entityAccount.publicKey.toBase58();
        
        // The entity in the local world uses the on-chain account's public key as its primary identifier
        const entity = this.world.createEntity(entityId, entityAccount.publicKey);

        for (const [componentType, data] of Object.entries(components)) {
            // Use processComponent for validation and adding component
            this.processComponent(entityId, componentType, data);
        }
        
        // Save to chain using the storage adapter, which needs a payer.
        const serializedEntityData = this.serializeEntityData(entity); // serializeEntityData is a placeholder
        
        try {
            // TODO: Determine worldName for storage operations. For now, using default or allowing override.
            // The SolanaStorageAdapter.createEntity method expects entityData, payer, and optional worldName.
            const signature = await this.storage.createEntity(serializedEntityData, payer, "default_world");
            console.log(`Entity ${entityId} created on-chain. Signature: ${signature}`);
        } catch (error) {
             throw new SDKError(`Failed to save entity ${entityId} to chain during creation.`, error);
        }

        return entity;
    }

    public addSystem(system: SystemPort): void {
        this.world.addSystem(system);
    }

    public update(deltaTime: number): void {
        this.world.update(deltaTime);
    }

    // Method to process and validate a component based on the blueprint
    public processComponent(entityId: string, componentType: string, componentData: any): void {
        // If a blueprint is loaded, validate the component against it.
        if (this.blueprint) {
            // Check if componentSchemas is defined in the blueprint.
            if (this.blueprint.componentSchemas) {
                // Check if the component type exists in the blueprint's componentSchemas.
                if (!(componentType in this.blueprint.componentSchemas)) {
                    throw new SDKError(`Component type "${componentType}" is not defined in the blueprint's componentSchemas.`);
                }

                // Validate the component data against the schema.
                const schema = this.blueprint.componentSchemas[componentType];
                this.validateComponentDataAgainstSchema(componentData, schema, componentType);
                console.log(`Component "${componentType}" for entity "${entityId}" validated successfully against blueprint. Data: ${JSON.stringify(componentData)}`);
            } else {
                console.warn(`Blueprint "${this.blueprint.name}" is loaded but does not contain a 'componentSchemas' definition. Skipping validation for component "${componentType}".`);
            }
        }

        // Add the component to the entity if it exists locally.
        const entity = this.world.getEntity(entityId);
        if (entity) {
            entity.addComponent(componentType, componentData);
        } else {
            // Optionally handle entity creation if it doesn't exist, or throw an error
            // This behavior might depend on how processComponent is intended to be used.
            console.warn(`Entity "${entityId}" not found locally. Component "${componentType}" was validated but not added.`);
            // throw new SDKError(`Entity "${entityId}" not found.`);
        }
    }

    // Helper function for schema validation (can be expanded)
    private validateComponentDataAgainstSchema(data: any, schema: ComponentSchema, componentType: string): void {
        if (schema.type && typeof data !== schema.type && !(Array.isArray(schema.type) && schema.type.includes(typeof data))) {
             // Handle cases where schema.type can be an array of types
            let typeMatch = false;
            if (Array.isArray(schema.type)) {
                if (schema.type.includes(typeof data)) typeMatch = true;
                if (schema.type.includes("array") && Array.isArray(data)) typeMatch = true;
                if (schema.type.includes("null") && data === null) typeMatch = true;
            } else {
                 // schema.type is a single string
                if (schema.type === "array" && Array.isArray(data)) typeMatch = true;
                else if (schema.type === "null" && data === null) typeMatch = true;
                else if (typeof data === schema.type) typeMatch = true;
            }

            if (!typeMatch) {
                throw new SDKError(
                    `Data for component "${componentType}" has incorrect type. Expected ${Array.isArray(schema.type) ? schema.type.join(' or ') : schema.type}, got ${typeof data}.`
                );
            }
        }

        if (schema.type === 'object') {
            if (typeof data !== 'object' || data === null || Array.isArray(data)) {
                throw new SDKError(`Component "${componentType}" data expected to be an object, got ${typeof data}.`);
            }

            // Check for required properties
            if (schema.required) {
                for (const requiredProp of schema.required) {
                    if (!(requiredProp in data)) {
                        throw new SDKError(`Missing required property "${requiredProp}" for component "${componentType}".`);
                    }
                }
            }

            // Check individual property types and schemas (recursively)
            if (schema.properties) {
                for (const propName in schema.properties) {
                    if (propName in data) {
                        this.validateComponentDataAgainstSchema(data[propName], schema.properties[propName], `${componentType}.${propName}`);
                    } else if (!schema.properties[propName].optional && !(schema.required && schema.required.includes(propName))){
                        // This case implies a property is defined in schema but not marked optional, and also not in 'data'.
                        // If it's not in `required` either, it means it should have been provided or marked optional.
                        // However, standard JSON schema practice is that presence implies requirement unless not in `required` array.
                        // Our `optional` flag is custom. If `optional: true` is not set, and it's not in `required` array, it's technically optional by JSON schema spec.
                        // But if we want all defined properties to be present unless optional:true, uncomment below.
                        // throw new SDKError(`Missing property "${propName}" for component "${componentType}" (and not marked optional).`);
                    }
                }
                // Check for extra properties not defined in schema (optional behavior)
                for (const dataKey in data) {
                    if (!(dataKey in schema.properties)) {
                         console.warn(`Warning: Component "${componentType}" has extra property "${dataKey}" not defined in blueprint schema.`);
                         // Or throw new SDKError(`Extra property "${dataKey}" not allowed for component "${componentType}".`);
                    }
                }
            }
        } else if (schema.type === 'array') {
            if (!Array.isArray(data)) {
                throw new SDKError(`Component "${componentType}" data expected to be an array, got ${typeof data}.`);
            }
            if (schema.items && data.length > 0) {
                 // Simplified: assumes schema.items is a single schema, not an array of schemas (tuple validation)
                const itemSchema = Array.isArray(schema.items) ? schema.items[0] : schema.items; 
                if(itemSchema){
                    for (let i = 0; i < data.length; i++) {
                        this.validateComponentDataAgainstSchema(data[i], itemSchema, `${componentType}[${i}]`);
                    }
                }
            }
        }

        // Add other validations based on schema properties (minLength, maxLength, pattern, min, max, etc.)
        if (schema.minLength !== undefined && typeof data === 'string' && data.length < schema.minLength) {
            throw new SDKError(`Component "${componentType}" string length ${data.length} is less than minimum ${schema.minLength}.`);
        }
        if (schema.maxLength !== undefined && typeof data === 'string' && data.length > schema.maxLength) {
            throw new SDKError(`Component "${componentType}" string length ${data.length} exceeds maximum ${schema.maxLength}.`);
        }
        if (schema.minimum !== undefined && typeof data === 'number' && data < schema.minimum) {
            throw new SDKError(`Component "${componentType}" value ${data} is less than minimum ${schema.minimum}.`);
        }
        if (schema.maximum !== undefined && typeof data === 'number' && data > schema.maximum) {
            throw new SDKError(`Component "${componentType}" value ${data} exceeds maximum ${schema.maximum}.`);
        }
        if (schema.pattern && typeof data === 'string' && !new RegExp(schema.pattern).test(data)) {
            throw new SDKError(`Component "${componentType}" value "${data}" does not match pattern "${schema.pattern}".`);
        }
    }

    // TODO: Implement proper deserialization based on your on-chain program's data structures.
    // Consider using a robust binary serialization library like Borsh (https://borsh.io/).
    // The structure of OnChainEntityData needs to exactly match your on-chain layout.
    private deserializeEntityData(data: Buffer): OnChainEntityData | null {
        try {
            // This is a placeholder. Replace with your actual deserialization logic (e.g., using Borsh).
            const jsonData = JSON.parse(data.toString());
            // Validate jsonData structure
            if (jsonData && typeof jsonData.id === 'string' && typeof jsonData.owner === 'string' && typeof jsonData.components === 'object') {
                return jsonData as OnChainEntityData;
            }
            console.warn('Failed to deserialize or validate entity data:', jsonData);
            return null;
        } catch (error) {
            console.error('Error deserializing entity data:', error);
            return null;
        }
    }

    // TODO: Implement proper serialization based on your on-chain program's data structures.
    // Consider using a robust binary serialization library like Borsh (https://borsh.io/).
    // This data will be sent to your Solana program instruction.
    private serializeEntityData(entity: Entity): Buffer {
        // This is a placeholder. Replace with your actual serialization logic (e.g., using Borsh).
        // Ensure this aligns with what the on-chain program expects for createEntity and setEntityDataById.
        const data: OnChainEntityData = {
            id: entity.getId(),
            owner: entity.getPublicKey().toBase58(), // Assuming entity.getPublicKey() is the account key
            components: Object.fromEntries(entity.getComponents()),
        };
        return Buffer.from(JSON.stringify(data)); // Placeholder serialization
    }

    public async syncWithChain(): Promise<void> {
        // syncWithChain primarily reads data, so payer isn't directly involved unless it needs to update local state based on who is asking.
        // If syncWithChain could *write* (e.g. initializing entities not found locally), it would need a payer.
        // For now, assuming read-only or uses pre-set wallet for any minor writes.
        const currentPayerForSync = this.wallet; // Or decide if getActivePayer is relevant for sync too.
        if (!currentPayerForSync) { // Changed from this.wallet to currentPayerForSync for clarity
            throw new SDKError('Wallet not set. Cannot sync with chain.');
        }
        console.log('Syncing world state with the blockchain...');
        try {
            // TODO: Optimize account fetching.
            // Fetching all program accounts can be slow and costly for large numbers of entities.
            // Consider implementing indexed queries if your on-chain program supports them,
            // or maintaining a local list of known entity account PublicKeys to query directly.
            const accounts = await this.storage.getConnection().getProgramAccounts(this.storage.getProgramId());

            for (const accountInfo of accounts) {
                const onChainData = this.deserializeEntityData(accountInfo.account.data);
                if (onChainData) {
                    let entity = this.world.getEntity(onChainData.id);
                    if (!entity) {
                        // Create entity if it doesn't exist locally
                        entity = this.world.createEntity(onChainData.id, new PublicKey(onChainData.owner)); 
                    }
                    // Update/set components from on-chain data
                    entity.getComponents().clear(); // Clear existing components before syncing
                    for (const [type, data] of Object.entries(onChainData.components)) {
                        this.processComponent(onChainData.id, type, data);
                    }
                } else {
                    console.warn(`Failed to deserialize data for account: ${accountInfo.pubkey.toBase58()}`);
                }
            }
            console.log('World synchronized with blockchain.');
        } catch (error) {
            throw new SDKError('Failed to sync with chain', error);
        }
    }

    private async saveEntityToChain(entity: Entity): Promise<void> {
        const payer = this.getActivePayer(); // Use active payer

        // TODO: Implement a dirty flag system for entities and components.
        // Only entities/components that have changed should be saved to the chain.
        // This check should happen before calling serializeEntityData.

        try {
            const serializedData = this.serializeEntityData(entity);
            const entityAccountPublicKey = entity.getPublicKey(); 

            // Use SolanaStorageAdapter.setEntityDataById which handles PDA derivation based on entity.getId()
            // This assumes entity.getId() is the string ID used in PDA derivation for entities.
            // TODO: Confirm worldName parameter logic. Using default for now.
            await this.storage.setEntityDataById(entity.getId(), serializedData, payer, "default_world");
            console.log(`Entity ${entity.getId()} saved/updated on chain via setEntityDataById.`);

        } catch (error) {
            throw new SDKError(`Failed to save entity ${entity.getId()} to chain`, error);
        }
    }

    public async saveToChain(): Promise<void> {
        const payer = this.getActivePayer(); // Use active payer
        // This check is somewhat redundant if getActivePayer throws, but good for defense.
        if (!payer) { 
             throw new SDKError('Payer not available. Cannot save to chain.');
        }
        console.log('Saving world state to the blockchain...');
        // TODO: Implement transaction batching.
        // If many entities need to be saved, batch them into fewer transactions
        // to improve performance and reduce transaction fees, respecting Solana transaction size limits.
        try {
            const entitiesToSave: Entity[] = []; // Collect entities that need saving (e.g., based on dirty flag)
            for (const entity of this.world.query([])) { 
                // if (entity.isDirty()) { entitiesToSave.push(entity); }
                entitiesToSave.push(entity); // Placeholder: save all for now
            }

            for (const entity of entitiesToSave) {
                await this.saveEntityToChain(entity); // Current: one transaction per entity
            }
            console.log('World state saved to blockchain.');
        } catch (error) {
            throw new SDKError('Failed to save world state to chain', error);
        }
    }

    // Example of a more specific error
    public exampleMethodThatCouldFail() {
        if (Math.random() < 0.5) {
            throw new SDKError('Random failure in example method', new Error('Underlying cause'));
        }
    }
} 