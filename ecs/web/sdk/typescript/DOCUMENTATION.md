# Rush Web SDK Documentation

## Overview

The Rush Web SDK is a TypeScript-based Software Development Kit designed for building web3 games using Rush's Entity Component System (ECS) architecture with seamless integration with the Solana blockchain. This SDK provides developers with tools to create complex, scalable, and efficient game architectures by leveraging the power of ECS and blockchain technology.

## Key Features

- **Entity Component System (ECS) Architecture**: Organize game logic into entities, components, and systems for better scalability and maintainability.
- **Solana Blockchain Integration**: Connect game state and logic to the Solana blockchain for decentralized, secure, and transparent gameplay.
- **Type-Safe Component Management**: Ensure type safety when defining and manipulating game components.
- **Efficient Entity Querying**: Quickly retrieve entities based on their components for optimized game updates.
- **Blockchain State Synchronization**: Keep game state in sync with on-chain data for consistency across clients.
- **Modern TypeScript Implementation**: Built with TypeScript for robust, maintainable, and modern codebases.

## Installation

To install the Rush Web SDK, use npm:

```bash
npm install @rush/web-sdk
```

Ensure you have the necessary peer dependencies installed, such as `@solana/web3.js` for blockchain interactions.

## Getting Started

### Initializing the SDK

To start using the Rush Web SDK, initialize it with a Solana connection and your program's public key:

```typescript
import { Connection, PublicKey } from '@solana/web3.js';
import { RushSDK } from '@rush/web-sdk';

// Create a connection to the Solana network
const connection = new Connection('https://api.devnet.solana.com');
const programId = new PublicKey('your_program_id_here');

// Initialize the SDK
const sdk = new RushSDK(connection, programId);
```

### Setting Up a Wallet

Configure a wallet for blockchain interactions:

```typescript
import { Keypair } from '@solana/web3.js';

// Generate a new keypair or use an existing wallet
const wallet = Keypair.generate();
sdk.setWallet(wallet);
```

### Creating Entities

Entities are the core of your game world. Create an entity with initial components:

```typescript
const entity = await sdk.createEntity({
    position: { x: 0, y: 0, z: 0 },
    health: { current: 100, max: 100 }
});
```

### Defining Systems

Systems contain the game logic that operates on entities with specific components:

```typescript
import { System, World } from '@rush/web-sdk';

class MovementSystem implements System {
    update(deltaTime: number, world: World) {
        const entities = world.query(['position']);
        for (const entity of entities) {
            const position = entity.getComponent('position');
            // Example: Update position based on some logic
            position.x += 1;
            entity.addComponent('position', position);
        }
    }
}

// Add the system to the SDK
sdk.addSystem(new MovementSystem());
```

### Game Loop

Set up a game loop to update the state of your game world:

```typescript
function gameLoop(timestamp: number) {
    sdk.update(timestamp);
    requestAnimationFrame(gameLoop);
}

// Start the game loop
requestAnimationFrame(gameLoop);
```

## Core Architecture

The Rush Web SDK is built around the following core concepts:

1. **Entity**: A unique identifier that represents a game object, associated with various components.
2. **Component**: Data structures that define the attributes or behaviors of entities (e.g., position, health).
3. **System**: Logic modules that operate on entities possessing specific components, handling game mechanics.
4. **World**: The container for all entities, components, and systems, managing their interactions and updates.
5. **Storage**: Manages synchronization of game state with the Solana blockchain for persistence and consistency.

## API Reference

### `RushSDK` Class

The main class for interacting with the Rush Web SDK.

- **Constructor**: `constructor(connection: Connection, programId: PublicKey)`
  - Initializes the SDK with a Solana connection and program ID.
- **`setWallet(wallet: Keypair): void`**
  - Sets the wallet for blockchain transactions.
- **`createEntity(components?: Record<string, any>): Promise<Entity>`**
  - Creates a new entity with optional initial components.
- **`addSystem(system: System): void`**
  - Registers a new system to the game world.
- **`update(deltaTime: number): void`**
  - Updates all systems with the given delta time.
- **`syncWithChain(): Promise<void>`**
  - Synchronizes local game state with the blockchain.
- **`saveToChain(): Promise<void>`**
  - Saves the current game state to the blockchain.

### `Entity` Class

Represents a single game object with associated components.

- **`getId(): string`**
  - Returns the unique identifier of the entity.
- **`addComponent<T>(componentType: string, data: T): void`**
  - Adds or updates a component of the specified type with the given data.
- **`getComponent<T>(componentType: string): T | undefined`**
  - Retrieves the data for a specific component type.
- **`hasComponent(componentType: string): boolean`**
  - Checks if the entity has a component of the specified type.
- **`removeComponent(componentType: string): boolean`**
  - Removes a component of the specified type from the entity.

### `World` Class

Manages entities, components, and systems.

- **`createEntity(id: string, publicKey: PublicKey): Entity`**
  - Creates a new entity with a specific ID and public key.
- **`getEntity(id: string): Entity | undefined`**
  - Retrieves an entity by its ID.
- **`removeEntity(id: string): boolean`**
  - Removes an entity from the world.
- **`addSystem(system: System): void`**
  - Adds a system to the world.
- **`update(deltaTime: number): void`**
  - Updates all systems in the world.
- **`query(components: string[]): Entity[]`**
  - Returns entities that have all the specified components.

## Blockchain Integration

The Rush Web SDK integrates with the Solana blockchain to enable decentralized game mechanics. Key aspects include:

- **State Persistence**: Game state can be saved to and loaded from the blockchain, ensuring consistency across sessions and clients.
- **Transaction Handling**: Use the SDK to send transactions to update on-chain game state.
- **Security**: Leverage Solana's secure infrastructure for game logic that requires trustlessness.

To synchronize state:

```typescript
// Save current state to blockchain
await sdk.saveToChain();

// Sync local state with blockchain
await sdk.syncWithChain();
```

## Best Practices

- **Modular Systems**: Break down game logic into small, focused systems for better maintainability.
- **Component Design**: Keep components as simple data structures without logic to adhere to ECS principles.
- **Efficient Queries**: Optimize entity queries to minimize performance overhead in large game worlds.
- **Blockchain Usage**: Use blockchain synchronization judiciously to balance performance and decentralization.

## Troubleshooting

- **Connection Issues**: Ensure your Solana connection URL is correct and the network is accessible.
- **Wallet Errors**: Verify that the wallet is properly configured and has sufficient funds for transactions.
- **Entity Not Found**: Check if entities are being created and registered correctly in the world.
- **Performance Lag**: Profile systems and queries to identify bottlenecks in game updates.

## Contributing

We welcome contributions to the Rush Web SDK. Please refer to our [Contributing Guide](../../CONTRIBUTING.md) for details on our code of conduct and the process for submitting pull requests.

## License

This project is licensed under the Apache-2.0 License. See the [LICENSE](../../LICENSE) file for details.

