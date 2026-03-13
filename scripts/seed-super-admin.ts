/**
 * Seed Script: Super Admin Account
 * 
 * Creates or updates the root super admin account.
 * Run with: npx tsx scripts/seed-super-admin.ts
 * 
 * Prerequisites:
 *   - NEXT_PUBLIC_SUPABASE_URL env var set
 *   - SUPABASE_SERVICE_ROLE_KEY env var set
 * 
 * Credentials:
 *   Email:    theo@iworkrapp.com
 *   Password: lowerUPPER#123
 */

import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const ADMIN_EMAIL = "theo@iworkrapp.com";
const ADMIN_PASSWORD = "lowerUPPER#123";

async function seedSuperAdmin() {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    console.error("❌ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  console.log("🔑 Seeding super admin account...");
  console.log(`   Email: ${ADMIN_EMAIL}`);
  console.log(`   URL:   ${SUPABASE_URL}`);

  // Check if user already exists
  const { data: existingUsers } = await supabase.auth.admin.listUsers();
  const existing = existingUsers?.users?.find(
    (u) => u.email === ADMIN_EMAIL
  );

  let userId: string;

  if (existing) {
    console.log(`\n✅ User already exists: ${existing.id}`);
    userId = existing.id;

    // Update password
    const { error: updateError } = await supabase.auth.admin.updateUserById(
      existing.id,
      { password: ADMIN_PASSWORD, email_confirm: true }
    );
    if (updateError) {
      console.error("❌ Failed to update password:", updateError.message);
    } else {
      console.log("✅ Password updated");
    }
  } else {
    // Create user
    const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
      email_confirm: true,
    });

    if (createError) {
      console.error("❌ Failed to create user:", createError.message);
      process.exit(1);
    }

    userId = newUser.user.id;
    console.log(`\n✅ User created: ${userId}`);
  }

  // Ensure profile exists with is_super_admin = true
  const { error: upsertError } = await supabase
    .from("profiles")
    .upsert(
      {
        id: userId,
        email: ADMIN_EMAIL,
        full_name: "Theo (Super Admin)",
        is_super_admin: true,
      },
      { onConflict: "id" }
    );

  if (upsertError) {
    console.error("❌ Failed to upsert profile:", upsertError.message);
    console.log("   (This may be because is_super_admin column doesn't exist yet. Run migration 084 first.)");
  } else {
    console.log("✅ Profile updated with is_super_admin = true");
  }

  console.log("\n🏛️  Super Admin seeding complete!");
  console.log("   Navigate to /olympus to access the control plane.");
}

seedSuperAdmin().catch(console.error);
