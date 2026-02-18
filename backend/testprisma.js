const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function test() {
  try {
    console.log('Testing Prisma...');
    
    // Test 1: Count users
    const count = await prisma.users.count();
    console.log('✅ Users count:', count);
    
    // Test 2: Find all users
    const users = await prisma.users.findMany();
    console.log('✅ Users found:', users.length);
    console.log('Users:', JSON.stringify(users, null, 2));
    
  } catch (error) {
    console.error('❌ Prisma error:', error.message);
    console.error('Full error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

test();