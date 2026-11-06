import { validatePasswordStrength } from "../lib/passwordPolicy";

console.log("\n=== Password Policy Tests ===\n");

const testCases = [
  { password: "weak", expected: false, description: "Too short" },
  { password: "SecurePass123!@#", expected: true, description: "Valid strong password" },
  { password: "short", expected: false, description: "Less than 12 characters" },
  { password: "nouppercase123!", expected: false, description: "Missing uppercase" },
  { password: "NOLOWERCASE123!", expected: false, description: "Missing lowercase" },
  { password: "NoDigitsHere!", expected: false, description: "Missing digits" },
  { password: "NoSpecialChar123", expected: false, description: "Missing special characters" },
  { password: "ValidPass123!", expected: true, description: "Valid password" },
];

testCases.forEach((test, index) => {
  const result = validatePasswordStrength(test.password);
  const pass = result.valid === test.expected ? "✓ PASS" : "✗ FAIL";
  console.log(`Test ${index + 1}: ${pass} - ${test.description}`);
  console.log(`  Password: "${test.password}"`);
  console.log(`  Result: ${JSON.stringify(result)}\n`);
});

console.log("=== Tests Complete ===\n");
