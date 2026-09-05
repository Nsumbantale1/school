import "dotenv/config";
import * as readline from "readline";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { eq } from "drizzle-orm";
import { users } from "../lib/db/schema/users";
import { hashPassword } from "../lib/auth";

function ask(question: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

function askHidden(question: string): Promise<string> {
  return new Promise((resolve) => {
    process.stdout.write(question);
    const stdin = process.stdin;
    const wasRaw = stdin.isRaw;
    if (!stdin.isTTY) {
      ask("").then(resolve);
      return;
    }

    stdin.setRawMode?.(true);
    stdin.resume();
    stdin.setEncoding("utf8");

    let password = "";
    const onData = (char: string) => {
      if (char === "\n" || char === "\r" || char === "\u0004") {
        stdin.setRawMode?.(wasRaw ?? false);
        stdin.pause();
        stdin.removeListener("data", onData);
        process.stdout.write("\n");
        resolve(password);
        return;
      }
      if (char === "\u0003") {
        process.stdout.write("\n");
        process.exit(1);
      }
      if (char === "\u007f" || char === "\b") {
        if (password.length > 0) {
          password = password.slice(0, -1);
          process.stdout.write("\b \b");
        }
        return;
      }
      password += char;
      process.stdout.write("*");
    };

    stdin.on("data", onData);
  });
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("ERROR: DATABASE_URL not set. Check .env.local");
    process.exit(1);
  }

  const sql = neon(process.env.DATABASE_URL);
  const db = drizzle(sql);

  console.log("=== Change User Password ===\n");

  const username = await ask("Username (e.g. admin): ");
  if (!username) {
    console.error("Username is required.");
    process.exit(1);
  }

  const [user] = await db
    .select({ id: users.id, username: users.username, name: users.name })
    .from(users)
    .where(eq(users.username, username))
    .limit(1);

  if (!user) {
    console.error(`User "${username}" not found.`);
    process.exit(1);
  }

  console.log(`Found: ${user.name} (${user.username})\n`);

  const newPassword = await askHidden("New password: ");
  const confirmPassword = await askHidden("Confirm new password: ");

  if (!newPassword || newPassword.length < 8) {
    console.error("Password must be at least 8 characters.");
    process.exit(1);
  }

  if (newPassword !== confirmPassword) {
    console.error("Passwords do not match.");
    process.exit(1);
  }

  const passwordHash = await hashPassword(newPassword);
  await db
    .update(users)
    .set({ passwordHash })
    .where(eq(users.id, user.id));

  console.log(`\nPassword updated for "${user.username}".`);
  console.log("Use the new password next time you log in.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
