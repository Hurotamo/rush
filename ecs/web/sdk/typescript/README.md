# Rush Web SDK

A TypeScript SDK for building web3 games using Rush's Entity Component System (ECS) with Solana blockchain integration.

## Features

- Entity Component System (ECS) architecture
- Solana blockchain integration
- Type-safe component management
- Efficient entity querying
- Blockchain state synchronization
- Modern TypeScript implementation

## Installation

```bash
npm install @rush/web-sdk
```

## Quick Start

```typescript
import { Connection, Keypair } from '@solana/web3.js';
import { RushSDK } from '@rush/web-sdk';

// Initialize the SDK
const connection = new Connection('https://api.devnet.solana.com');
const programId = new PublicKey('your_program_id');
const sdk = new RushSDK(connection, programId);

// Set up wallet
const wallet = Keypair.generate(); // Or use your wallet integration
sdk.setWallet(wallet);

// Create an entity with components
const entity = await sdk.createEntity({
    position: { x: 0, y: 0, z: 0 },
    health: { current: 100, max: 100 }
});

// Create a system
class MovementSystem implements System {
    update(deltaTime: number, world: World) {
        const entities = world.query(['position']);
        for (const entity of entities) {
            const position = entity.getComponent('position');
            // Update position logic
        }
    }
}

// Add system to the world
sdk.addSystem(new MovementSystem());

// Game loop
function gameLoop(timestamp: number) {
    sdk.update(timestamp);
    requestAnimationFrame(gameLoop);
}

// Start the game
requestAnimationFrame(gameLoop);
```

## Architecture

The SDK is built on these core concepts:

1. **Entity**: A unique identifier with associated components
2. **Component**: Plain data objects that define entity attributes
3. **System**: Logic that operates on entities with specific components
4. **World**: Manages entities, components, and systems
5. **Storage**: Handles blockchain state synchronization

## API Reference

### RushSDK

- `constructor(connection: Connection, programId: PublicKey)`
- `setWallet(wallet: Keypair): void`
- `createEntity(components?: Record<string, any>): Promise<Entity>`
- `addSystem(system: System): void`
- `update(deltaTime: number): void`
- `syncWithChain(): Promise<void>`
- `saveToChain(): Promise<void>`

### Entity

- `getId(): string`
- `addComponent<T>(componentType: string, data: T): void`
- `getComponent<T>(componentType: string): T | undefined`
- `hasComponent(componentType: string): boolean`
- `removeComponent(componentType: string): boolean`

### World

- `createEntity(id: string, publicKey: PublicKey): Entity`
- `getEntity(id: string): Entity | undefined`
- `removeEntity(id: string): boolean`
- `addSystem(system: System): void`
- `update(deltaTime: number): void`
- `query(components: string[]): Entity[]`

## Contributing

Please read our [Contributing Guide](../../CONTRIBUTING.md) for details on our code of conduct and the process for submitting pull requests.

## License

This project is licensed under the Apache-2.0 License - see the [LICENSE](../../LICENSE) file for details. 