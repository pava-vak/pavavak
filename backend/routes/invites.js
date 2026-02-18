const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Validate invite code (used during registration)
router.post('/validate', async (req, res) => {
  try {
    const { code } = req.body;
    
    console.log('=== VALIDATE REQUEST ===');
    console.log('Received code:', code);
    console.log('After uppercase:', code ? code.toUpperCase() : 'null');
    
    if (!code) {
      console.log('❌ No code provided');
      return res.status(400).json({ valid: false, error: 'Invite code is required' });
    }

    const searchCode = code.toUpperCase();
    console.log('Searching for code:', searchCode);
    
    const invite = await prisma.invite_codes.findUnique({
      where: { code: searchCode }
    });

    console.log('Database result:', invite);
    
    if (!invite) {
      console.log('❌ Invite not found in database');
      return res.json({ valid: false, reason: 'Invalid code' });
    }
    
    if (invite.used) {
      console.log('❌ Invite already used');
      return res.json({ valid: false, reason: 'Code already used' });
    }
    
    // Check expiration (24 hours)
    const expirationTime = new Date(invite.created_at);
    expirationTime.setHours(expirationTime.getHours() + 24);
    
    console.log('Expiration check:');
    console.log('  Created:', invite.created_at);
    console.log('  Expires:', expirationTime);
    console.log('  Now:', new Date());
    console.log('  Is expired?', new Date() > expirationTime);
    
    if (new Date() > expirationTime) {
      console.log('❌ Code expired');
      return res.json({ valid: false, reason: 'Code expired' });
    }

    console.log('✅ CODE IS VALID!');
    res.json({ valid: true });
  } catch (error) {
    console.error('❌ Error validating invite code:', error);
    res.status(500).json({ valid: false, error: 'Failed to validate invite code' });
  }
});

// Generate invite code
router.post('/generate', async (req, res) => {
  try {
    const code = `PV-${Math.random().toString(36).substring(2, 6).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    
    await prisma.invite_codes.create({
      data: {
        code,
        used: false
      }
    });
    res.json({ success: true, code });
  } catch (error) {
    console.error('Error generating invite code:', error);
    res.status(500).json({ success: false, error: 'Failed to generate invite code' });
  }
});

// Get all invite codes
router.get('/list', async (req, res) => {
  try {
    const invites = await prisma.invite_codes.findMany({
      orderBy: { created_at: 'desc' }
    });
    res.json({
      success: true,
      invites: invites.map(i => ({
        code: i.code,
        used: i.used,
        createdAt: i.created_at
      }))
    });
  } catch (error) {
    console.error('Error fetching invite codes:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch invite codes' });
  }
});

// Delete invite code
router.delete('/:code', async (req, res) => {
  try {
    const code = req.params.code;
    const invite = await prisma.invite_codes.findUnique({
      where: { code }
    });
    if (!invite) {
      return res.status(404).json({ success: false, error: 'Invite code not found' });
    }
    if (invite.used) {
      return res.status(400).json({ success: false, error: 'Cannot delete used invite code' });
    }
    await prisma.invite_codes.delete({ where: { code } });
    res.json({ success: true, message: 'Invite code deleted' });
  } catch (error) {
    console.error('Error deleting invite code:', error);
    res.status(500).json({ success: false, error: 'Failed to delete invite code' });
  }
});

module.exports = router;