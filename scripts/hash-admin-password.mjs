import { pbkdf2Sync, randomBytes } from "node:crypto";
import { stdin, stdout } from "node:process";
import { createInterface } from "node:readline/promises";

const terminal = createInterface({ input: stdin, output: stdout });
const password = await terminal.question("请输入新的 HAIRFORM 管理员密码（输入内容可能可见）：");
terminal.close();
if (password.length < 12) {
  console.error("密码至少需要12个字符。");
  process.exitCode = 1;
} else {
  const salt = randomBytes(18);
  const iterations = 100000;
  const digest = pbkdf2Sync(password, salt, iterations, 32, "sha256");
  console.log(`pbkdf2_sha256_hex:${iterations}:${salt.toString("hex")}:${digest.toString("hex")}`);
}
