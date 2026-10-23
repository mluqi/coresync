const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { User, Tenant, TenantModule } = require('../models');
const { deleteLocalFile } = require('../utils/fileHelper');
const { logAccess, logActivity } = require('../utils/logger');

exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // Validate inputs
    if (!email || !password) {
      await logAccess(req, { email, action: 'LOGIN_FAILED', status: 'FAILED', reason: 'Email & sandi wajib diisi.' });
      return res.status(400).json({
        success: false,
        message: 'Please provide email and password.'
      });
    }

    // Find user and include tenant profile + modules
    const user = await User.findOne({
      where: { email },
      include: [
        {
          model: Tenant,
          as: 'tenant',
          include: [
            {
              model: TenantModule,
              as: 'modules'
            }
          ]
        }
      ]
    });

    if (!user) {
      await logAccess(req, { email, action: 'LOGIN_FAILED', status: 'FAILED', reason: 'Pengguna tidak ditemukan.' });
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.'
      });
    }

    // Verify password
    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      await logAccess(req, { email, action: 'LOGIN_FAILED', status: 'FAILED', reason: 'Kata sandi salah.', userId: user.id, tenantId: user.tenantId });
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.'
      });
    }

    // Prepare tenant modules status dictionary
    const modules = {};
    if (user.tenant && user.tenant.modules) {
      user.tenant.modules.forEach(mod => {
        modules[mod.moduleName] = mod.isEnabled;
      });
    }

    // Create JWT Token
    const payload = {
      id: user.id,
      tenantId: user.tenantId,
      warehouseId: user.warehouseId,
      role: user.role,
      email: user.email,
      name: user.name,
      metadata: user.metadata
    };

    const token = jwt.sign(
      payload,
      process.env.JWT_SECRET || 'supersecretkeycoresync2026',
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    // Save active token in database for single-device session tracking
    await user.update({ userToken: token });

    await logAccess(req, { email: user.email, action: 'LOGIN_SUCCESS', status: 'SUCCESS', reason: 'Berhasil Masuk', userId: user.id, tenantId: user.tenantId });

    return res.status(200).json({
      success: true,
      message: 'Login successful.',
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        warehouseId: user.warehouseId,
        metadata: user.metadata
      },
      tenant: user.tenant ? {
        id: user.tenant.id,
        companyName: user.tenant.companyName,
        subdomain: user.tenant.subdomain,
        taxStatus: user.tenant.taxStatus,
        defaultTaxId: user.tenant.defaultTaxId,
        settings: user.tenant.settings,
        modules
      } : null
    });


  } catch (error) {
    next(error);
  }
};

exports.me = async (req, res, next) => {
  try {
    // Get user details using token payload data
    const user = await User.findByPk(req.user.id, {
      attributes: { exclude: ['passwordHash'] },
      include: [
        {
          model: Tenant,
          as: 'tenant',
          include: [
            {
              model: TenantModule,
              as: 'modules'
            }
          ]
        }
      ]
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found.'
      });
    }

    // Prepare modules dictionary
    const modules = {};
    if (user.tenant && user.tenant.modules) {
      user.tenant.modules.forEach(mod => {
        modules[mod.moduleName] = mod.isEnabled;
      });
    }

    return res.status(200).json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        warehouseId: user.warehouseId,
        metadata: user.metadata
      },
      tenant: user.tenant ? {
        id: user.tenant.id,
        companyName: user.tenant.companyName,
        subdomain: user.tenant.subdomain,
        taxStatus: user.tenant.taxStatus,
        defaultTaxId: user.tenant.defaultTaxId,
        settings: user.tenant.settings,
        modules
      } : null
    });


  } catch (error) {
    next(error);
  }
};

exports.updateProfile = async (req, res, next) => {
  try {
    const { name, email, phone, avatar, address, bio } = req.body;

    const user = await User.findByPk(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User tidak ditemukan.' });
    }

    if (email && email !== user.email) {
      const existingEmail = await User.findOne({ where: { email } });
      if (existingEmail && existingEmail.id !== user.id) {
        return res.status(400).json({ success: false, message: 'Email tersebut sudah digunakan oleh akun lain.' });
      }
      user.email = email;
    }

    if (name) user.name = name;

    const currentMeta = user.metadata || {};
    const oldAvatar = currentMeta.avatar;

    let targetAvatar = currentMeta.avatar;

    if (req.uploadedImageUrl) {
      targetAvatar = req.uploadedImageUrl;
      if (oldAvatar && oldAvatar !== targetAvatar) {
        deleteLocalFile(oldAvatar);
      }
    } else if (avatar !== undefined) {
      if (avatar === '' || avatar === null) {
        targetAvatar = null;
        if (oldAvatar) {
          deleteLocalFile(oldAvatar);
        }
      } else {
        targetAvatar = avatar;
        if (oldAvatar && oldAvatar !== avatar) {
          deleteLocalFile(oldAvatar);
        }
      }
    }

    user.metadata = {
      ...currentMeta,
      phone: phone !== undefined ? phone : currentMeta.phone,
      avatar: targetAvatar,
      address: address !== undefined ? address : currentMeta.address,
      bio: bio !== undefined ? bio : currentMeta.bio
    };

    await user.save();

    await logActivity(req, {
      action: 'UPDATE',
      module: 'AUTH',
      description: `Pengguna ${user.name} memperbarui profil akun`,
      metadata: { userId: user.id, email: user.email }
    });

    return res.status(200).json({
      success: true,
      message: 'Profil berhasil diperbarui.',
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        warehouseId: user.warehouseId,
        metadata: user.metadata
      }
    });
  } catch (error) {
    next(error);
  }
};

exports.changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, message: 'Password saat ini dan password baru wajib diisi.' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ success: false, message: 'Password baru minimal 6 karakter.' });
    }

    const user = await User.findByPk(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User tidak ditemukan.' });
    }

    const isMatch = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: 'Password saat ini tidak sesuai.' });
    }

    const salt = await bcrypt.genSalt(10);
    user.passwordHash = await bcrypt.hash(newPassword, salt);
    await user.save();

    await logActivity(req, {
      action: 'UPDATE',
      module: 'AUTH',
      description: `Pengguna ${user.name} mengubah kata sandi akun`,
      metadata: { userId: user.id, email: user.email }
    });

    return res.status(200).json({
      success: true,
      message: 'Password berhasil diperbarui.'
    });
  } catch (error) {
    next(error);
  }
};

exports.logout = async (req, res, next) => {
  try {
    if (req.user && req.user.id) {
      await User.update(
        { userToken: null },
        { where: { id: req.user.id } }
      );
      await logAccess(req, { 
        email: req.user.email, 
        action: 'LOGOUT', 
        status: 'SUCCESS', 
        reason: 'Pengguna keluar / logout', 
        userId: req.user.id, 
        tenantId: req.user.tenantId 
      });
    }
    return res.status(200).json({
      success: true,
      message: 'Logout berhasil.'
    });
  } catch (error) {
    next(error);
  }
};

