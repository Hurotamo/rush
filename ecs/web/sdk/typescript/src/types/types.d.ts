import { Keypair, PublicKey } from "@solana/web3.js";

export enum ERpcUrl {
	Devnet = "https://api.devnet.solana.com",
	Mainnet = "https://api.mainnet-beta.solana.com",
	Testnet = "https://api.testnet.solana.com",
	Local = "http://127.0.0.1:8899",
}

export interface IBTreeMap {
	K: string;
	V: string;
	A: string;
}

// New: Component Schema Definitions
export type JsonSchemaType = "string" | "number" | "boolean" | "object" | "array" | "null" | "bigint" | "symbol" | "undefined" | "function";

export interface ComponentSchemaProperty {
    type: JsonSchemaType | JsonSchemaType[];
    description?: string;
    optional?: boolean; // Custom: true if property is not in schema's 'required' array
    // For objects
    properties?: Record<string, ComponentSchemaProperty>;
    required?: string[];
    // For arrays
    items?: ComponentSchemaProperty | ComponentSchemaProperty[];
    // For strings
    minLength?: number;
    maxLength?: number;
    pattern?: string;
    // For numbers
    minimum?: number;
    maximum?: number;
    // Add other JSON schema properties as needed: enum, format, etc.
}

export interface ComponentSchema extends ComponentSchemaProperty {
    // A component schema is essentially a ComponentSchemaProperty, typically an object.
    // Ensure top-level 'type' is usually 'object' for components with fields.
}

export interface IBluePrint {
	name: string;
	description: string;
    componentSchemas?: Record<string, ComponentSchema>; // New: Defines schemas for component types

    // Original IBTreeMap fields - their role might need to be re-evaluated or used for other metadata
	entities: IBTreeMap;
	regions: IBTreeMap;
	instances: IBTreeMap;
}

export interface IStorage {
	blueprint: string;
	programId: PublicKey | string;
	signer: Keypair;
	rpcUrl: string;
}

export interface ISigner {
	publicKey: PublicKey;
	secretKey: Uint8Array;
}
export interface ITsSdkParams {
	rpcUrl: string;
	programId: PublicKey | string;
	blueprintPath: string;
	keypair: Keypair;
}

declare global {
	interface Window {
		solana?: {
			isPhantom: boolean;
			connect: () => Promise<{ publicKey: PublicKey }>;
			signAndSendTransaction: (
				transaction: Transaction,
			) => Promise<{ signature: string }>;
		};
	}
}
