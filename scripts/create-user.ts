#!/usr/bin/env bun
import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import * as schema from "../src/lib/server/db/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";

// Parse command line arguments
const args = process.argv.slice(2);

function printUsage() {
    console.log("\nUsage: bun run scripts/create-user.ts [options]");
    console.log("\nOptions:");
    console.log("  --db <path>          Database path (default: ./spendbee.db)");
    console.log("\nExample:");
    console.log("  bun run scripts/create-user.ts");
    console.log("  bun run scripts/create-user.ts --db /path/to/custom.db");
    console.log("");
}

// Parse arguments
const options: Record<string, string> = {};
for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith("--")) {
        const key = args[i].substring(2);
        const value = args[i + 1];
        if (value && !value.startsWith("--")) {
            options[key] = value;
            i++; // Skip next arg since we used it as value
        }
    }
}

// Show help if requested
if (args.includes("--help") || args.includes("-h")) {
    printUsage();
    process.exit(0);
}

const dbPath = options.db || "./spendbee.db";

// Prompt for user input using Bun's built-in prompt
async function promptCredentials() {
    console.log("\n=== Create New User ===\n");

    const email = prompt("Email: ");
    const name = prompt("Name: ");
    const password = prompt("Password (min 6 characters): ");

    return {
        email: email || "",
        name: name || "",
        password: password || "",
    };
}

async function createUser() {
    try {
        // Get user credentials interactively
        const { email, name, password } = await promptCredentials();

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            console.error("\n❌ Error: Invalid email format\n");
            process.exit(1);
        }

        // Validate password length
        if (password.length < 6) {
            console.error("\n❌ Error: Password must be at least 6 characters\n");
            process.exit(1);
        }

        // Validate name
        if (!name.trim()) {
            console.error("\n❌ Error: Name cannot be empty\n");
            process.exit(1);
        }

        // Connect to database
        const sqlite = new Database(dbPath);
        const db = drizzle(sqlite, { schema });

        console.log(`\nConnecting to database: ${dbPath}`);

        // Check if user already exists
        const existingUser = await db.query.users.findFirst({
            where: eq(schema.users.email, email),
        });

        if (existingUser) {
            console.error(`\n❌ Error: User with email '${email}' already exists\n`);
            sqlite.close();
            process.exit(1);
        }

        // Hash password
        console.log("Hashing password...");
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create user
        console.log("Creating user...");
        const [user] = await db
            .insert(schema.users)
            .values({
                email,
                password: hashedPassword,
                name,
            })
            .returning();

        console.log("\n✅ User created successfully!\n");
        console.log("User details:");
        console.log(`  ID: ${user.id}`);
        console.log(`  Email: ${user.email}`);
        console.log(`  Name: ${user.name}`);
        console.log(`  Created: ${user.createdAt}\n`);

        sqlite.close();
        process.exit(0);
    } catch (error) {
        console.error("\n❌ Failed to create user:");
        console.error(error);
        process.exit(1);
    }
}

createUser();
