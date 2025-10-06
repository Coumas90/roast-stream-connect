import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://ipjidjijilhpblxrnaeg.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY!;

if (!SUPABASE_SERVICE_KEY) {
  console.error('❌ SUPABASE_SERVICE_KEY not found in environment');
  console.error('   Add it to your .env file or pass it as an environment variable:');
  console.error('   SUPABASE_SERVICE_KEY=your_key npx tsx scripts/migrate-recipes-to-profiles.ts');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false }
});

async function migrateRecipesToProfiles() {
  console.log('🚀 Starting migration: recipes → coffee_profiles\n');
  
  // 1. Obtener todas las sucursales
  const { data: locations, error: locError } = await supabase
    .from('locations')
    .select('id, name, tenant_id');

  if (locError) {
    console.error('❌ Error fetching locations:', locError);
    process.exit(1);
  }

  console.log(`📍 Found ${locations.length} locations\n`);

  let successCount = 0;
  let skipCount = 0;
  let errorCount = 0;

  // 2. Para cada sucursal, crear coffee_profile
  for (const location of locations) {
    console.log(`🏪 Processing: ${location.name}`);

    // 2.1 Buscar receta activa del tenant
    const { data: activeRecipe, error: recipeError } = await supabase
      .from('recipes')
      .select('*')
      .eq('tenant_id', location.tenant_id)
      .eq('is_active', true)
      .maybeSingle();

    if (recipeError) {
      console.error(`  ❌ Error fetching recipe:`, recipeError);
      errorCount++;
      continue;
    }

    if (!activeRecipe) {
      console.log(`  ⚠️  No active recipe found for tenant`);
      skipCount++;
      continue;
    }

    // 2.2 Sanitizar parámetros de la receta
    const targetDose = Math.max(1, Math.min(30, parseFloat(activeRecipe.coffee_amount) || 18));
    const targetTemp = Math.max(80, Math.min(100, parseFloat(activeRecipe.temperature) || 93));

    console.log(`  ☕ Using recipe: ${activeRecipe.name}`);
    console.log(`     Dose: ${targetDose}g, Temp: ${targetTemp}°C`);

    // 2.3 Verificar si ya existe un perfil para esta location
    const { data: existingProfile } = await supabase
      .from('coffee_profiles')
      .select('id')
      .eq('location_id', location.id)
      .eq('active', true)
      .maybeSingle();

    if (existingProfile) {
      console.log(`  ℹ️  Profile already exists, skipping\n`);
      skipCount++;
      continue;
    }

    // 2.4 Crear coffee_profile
    const { error: insertError } = await supabase
      .from('coffee_profiles')
      .insert({
        name: `${activeRecipe.name} - ${location.name}`,
        location_id: location.id,
        tenant_id: location.tenant_id,
        recipe_id: activeRecipe.id,
        target_dose_g: targetDose,
        target_ratio_min: 1.8,
        target_ratio_max: 2.2,
        target_time_min: 25,
        target_time_max: 32,
        target_temp_c: targetTemp,
        brew_method: 'espresso',
        active: true,
      });

    if (insertError) {
      console.error(`  ❌ Error creating profile:`, insertError);
      errorCount++;
    } else {
      console.log(`  ✅ Profile created successfully\n`);
      successCount++;
    }
  }

  console.log('='.repeat(60));
  console.log('✅ Migration complete!\n');
  console.log(`   Profiles created: ${successCount}`);
  console.log(`   Skipped:          ${skipCount}`);
  console.log(`   Errors:           ${errorCount}`);
  console.log('='.repeat(60));

  if (errorCount > 0) {
    console.log('\n⚠️  Some profiles could not be created. Check errors above.');
    process.exit(1);
  }
}

migrateRecipesToProfiles()
  .then(() => {
    console.log('\n🎉 Migration completed successfully!');
    process.exit(0);
  })
  .catch((err) => {
    console.error('\n💥 Fatal error:', err);
    process.exit(1);
  });
