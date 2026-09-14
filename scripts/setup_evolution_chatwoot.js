/**
 * Script de Integración: Evolution API <-> Chatwoot
 * 
 * Uso:
 *   node scripts/setup_evolution_chatwoot.js
 * 
 * Variables aceptadas por entorno o interactivas:
 *   EVOLUTION_URL (default: https://evolution-api-production-c04d.up.railway.app)
 *   EVOLUTION_API_KEY (Tu API Key de Evolution API)
 *   EVOLUTION_INSTANCE (default: ANUBIS STORE)
 *   CHATWOOT_URL (ej: https://wsp-cmr-anubis-production.up.railway.app)
 *   CHATWOOT_TOKEN (Token de acceso de tu usuario en Chatwoot: Perfil -> Tokens de Acceso)
 *   CHATWOOT_ACCOUNT_ID (default: 1)
 */

const readline = require('readline');

async function ask(query) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  return new Promise(resolve => rl.question(query, ans => {
    rl.close();
    resolve(ans.trim());
  }));
}

async function main() {
  console.log('========================================================');
  console.log('  VINCULADOR NATIVO: EVOLUTION API -> CHATWOOT CRM');
  console.log('========================================================\n');

  const evoUrl = (process.env.EVOLUTION_URL || await ask('URL de Evolution API [https://evolution-api-production-c04d.up.railway.app]: ') || 'https://evolution-api-production-c04d.up.railway.app').replace(/\/+$/, '');
  const evoKey = process.env.EVOLUTION_API_KEY || await ask('API Key de Evolution API: ');
  const instance = process.env.EVOLUTION_INSTANCE || await ask('Nombre de Instancia [ANUBIS STORE]: ') || 'ANUBIS STORE';

  const cwUrl = (process.env.CHATWOOT_URL || await ask('URL pública de Chatwoot (ej: https://chatwoot-xxx.up.railway.app): ')).replace(/\/+$/, '');
  const cwToken = process.env.CHATWOOT_TOKEN || await ask('Token de Acceso de Usuario Chatwoot (Perfil -> Tokens de Acceso): ');
  const cwAccountId = process.env.CHATWOOT_ACCOUNT_ID || await ask('ID de Cuenta Chatwoot [1]: ') || '1';

  if (!evoKey) {
    console.error('Error: Se requiere la API Key de Evolution API.');
    process.exit(1);
  }
  if (!cwUrl || !cwToken) {
    console.error('Error: Se requiere la URL de Chatwoot y el Token de Acceso.');
    process.exit(1);
  }

  const encodedInstance = encodeURIComponent(instance);
  console.log(`\n1. Verificando estado de la instancia "${instance}" en Evolution API...`);

  try {
    const stateRes = await fetch(`${evoUrl}/instance/connectionState/${encodedInstance}`, {
      headers: { 'apikey': evoKey }
    });
    const stateData = await stateRes.json();
    console.log('   Respuesta de instancia:', JSON.stringify(stateData));

    console.log(`\n2. Vinculando "${instance}" con Chatwoot (${cwUrl})...`);
    const payload = {
      enabled: true,
      accountId: cwAccountId,
      token: cwToken,
      url: cwUrl,
      nameInbox: instance,
      signMsg: false,
      reopenConversation: true,
      conversationPending: false,
      importContacts: true,
      importMessages: true,
      daysLimitImportMessages: 30,
      autoCreate: true
    };

    const setRes = await fetch(`${evoUrl}/chatwoot/set/${encodedInstance}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': evoKey
      },
      body: JSON.stringify(payload)
    });

    const setData = await setRes.json();
    console.log('   Resultado de vinculación:', JSON.stringify(setData, null, 2));

    console.log('\n3. Comprobando configuración en Evolution API...');
    const findRes = await fetch(`${evoUrl}/chatwoot/find/${encodedInstance}`, {
      headers: { 'apikey': evoKey }
    });
    const findData = await findRes.json();
    console.log('   Configuración activa:', JSON.stringify(findData, null, 2));

    if (findData.enabled) {
      console.log('\n========================================================');
      console.log('¡VINCULACIÓN EXITOSA!');
      console.log(`Bandeja de entrada: "${instance}" creada en Chatwoot.`);
      console.log('Los mensajes de WhatsApp y contactos se sincronizarán en Chatwoot.');
      console.log('========================================================\n');
    } else {
      console.log('\nNota: Revisa la respuesta anterior para asegurar que todos los datos sean válidos.');
    }
  } catch (err) {
    console.error('\nError en la vinculación:', err.message);
  }
}

main();
