// describe('Test Suite', () => {
//     test('should run a simple test', () => {
//         expect(true).toBe(true);
//     });
// });

import bs58 from "bs58";
import { Storage } from "./modules/storage/storage";
import { RushSdk } from "./sdk";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { SessionAuth } from "./modules/session/session";
import { SolanaStorageAdapter } from "./storage/SolanaStorageAdapter";
console.log(
	"seeing this means you have successfully ran the scripts \nfrom src/test.ts file\n",
);

async function test_call_storage() {
	const new_keypair = Keypair.generate();

	const storage = new Storage({
		blueprint: "/my/blueprint/path",
		programId: new PublicKey(
			"6vg3oUN7LLcCS3Qc8bhsrqqJRkeDaC2KsFqF23aQp5iQ",
		),
		signer: new_keypair,
		rpcUrl: "http://127.0.0.1:8899",
	});

	console.log(storage);
	console.log("signer :", {
		"pubkey :": storage.signer.publicKey,
		"sec key :": storage.signer.secretKey,
	});
	console.log(storage.signer.secretKey);

	// Call the set method
	const entityId = "your_entity_id_here"; // Replace with a valid entity ID
	const data = { key: "value" }; // Sample data to update

	try {
		const signature = await storage.set(entityId, data);
		console.log(
			"Set function executed successfully. Signature:",
			signature,
		);
	} catch (error) {
		console.error("Error executing set function:", error);
	}
}

function test_call_rushsdk() {
	const new_keypair = Keypair.generate();
	const encoded = bs58.encode(new_keypair.secretKey);
	const secretKey = bs58.decode(encoded); // Pretend to be a secret key to be passed to creating the keypair
	const sdk = new RushSdk({
		keypair: new_keypair,
		blueprintPath: "/my/blueprint/path",
		programId: new_keypair.publicKey,
		rpcUrl: "http://127.0.0.1:8899",
	});

	console.log(sdk);
}

function test_call_migrate() {
	const new_keypair = Keypair.generate();
	const encoded = bs58.encode(new_keypair.secretKey);
	const secretKey = bs58.decode(encoded); // Pretend to be a secret key to be passed to creating the keypair
	const sdk = new RushSdk({
		keypair: new_keypair,
		blueprintPath: "/my/blueprint/path",
		programId: new_keypair.publicKey,
		rpcUrl: "http://127.0.0.1:8899",
	});
	sdk.migrate();
	// console.log(sdk);
}

function test_call_create() {
	const new_keypair = Keypair.generate();
	const encoded = bs58.encode(new_keypair.secretKey);
	const secretKey = bs58.decode(encoded); // Pretend to be a secret key to be passed to creating the keypair

	const sdk = new RushSdk({
		keypair: new_keypair,
		blueprintPath: "/my/blueprint/path",
		programId: new_keypair.publicKey,
		rpcUrl: "http://127.0.0.1:8899",
	});

	sdk.create();
}

async function setStorage(entityId: string, data: object) {
	const new_keypair = Keypair.generate();

	const storage = new Storage({
		blueprint: "/my/blueprint/path",
		programId: new PublicKey(
			"6vg3oUN7LLcCS3Qc8bhsrqqJRkeDaC2KsFqF23aQp5iQ",
		),
		signer: new_keypair,
		rpcUrl: "http://127.0.0.1:8899",
	});

	try {
		const signature = await storage.set(entityId, data);
		console.log(
			"Set function executed successfully. Signature:",
			signature,
		);
	} catch (error) {
		console.error("Error executing set function:", error);
	}
}

function test_call_session() {
	const connection = new Connection(
		"https://api.testnet.solana.com",
		"confirmed",
	);
	const auth = new SessionAuth(connection);
	const sessionKeypair = auth.createSession({ password: "lev" });
	console.log("Session Keypair Encrypted: ", sessionKeypair);

	console.log("DECRYPTING....");

	// const decrypted = auth.decrypt(sessionKeypair); // This is commented out since it is now private
}

// function test_call_create(){
// 	const sdk = new RushSdk({})
// }

// setStorage("your_entity_id_here", { key: "value" }); // Sample call to setStorage
// test_call_rushsdk();
// test_call_migrate();
// test_call_storage();
// test_call_create();
// test_call_session(); // Commented out to avoid window/localStorage error in Node.js

// Test function for SolanaStorageAdapter constructor
function testSolanaStorageAdapterConstructor() {
	console.log("\n--- Testing SolanaStorageAdapter Constructor ---");

	// 1. Create a dummy Connection object
	// For testing the constructor, we don't need a live connection.
	// We can mock the parts that might be accessed, or use a real one if simple enough.
	const dummyRpcUrl = "http://localhost:8899";
	const connection = new Connection(dummyRpcUrl, "confirmed");
	console.log("Input Connection RPC URL:", dummyRpcUrl);

	// 2. Create a dummy PublicKey
	const programIdString = "GNoUFcSjLftbjp2N2WNK2j1dt7J2gGVY1t2V1Sxs2tv1"; // Example program ID
	const programId = new PublicKey(programIdString);
	console.log("Input Program ID:", programId.toBase58());

	// 3. Instantiate SolanaStorageAdapter
	const adapter = new SolanaStorageAdapter(connection, programId);
	console.log("SolanaStorageAdapter instance created.");

	// 4. Retrieve and display the constructor-set values from the adapter
	const retrievedConnection = adapter.getConnection();
	const retrievedProgramId = adapter.getProgramId();

	console.log("Retrieved Connection RPC URL (from adapter.connection.rpcEndpoint):", retrievedConnection.rpcEndpoint);
	console.log("Retrieved Program ID (from adapter):", retrievedProgramId.toBase58());

	// 5. Check if the values are the same
	const isConnectionRpcSame = retrievedConnection.rpcEndpoint === dummyRpcUrl;
	const isProgramIdSame = retrievedProgramId.toBase58() === programIdString;

	console.log("Is Connection RPC URL the same?", isConnectionRpcSame);
	console.log("Is Program ID the same?", isProgramIdSame);

	if (isConnectionRpcSame && isProgramIdSame) {
		console.log("SolanaStorageAdapter constructor test: PASSED");
	} else {
		console.error("SolanaStorageAdapter constructor test: FAILED");
	}
	console.log("--- End of SolanaStorageAdapter Constructor Test ---\n");
}

// Call the new test function
testSolanaStorageAdapterConstructor();
