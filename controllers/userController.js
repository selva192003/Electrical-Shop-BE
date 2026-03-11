const crypto = require('crypto');
const { OAuth2Client } = require('google-auth-library');
const User = require('../models/User');
const generateToken = require('../utils/generateToken');
const sendEmail = require('../utils/sendEmail');
const { sendForgotPasswordOtpEmail, sendEmailVerificationEmail } = require('../utils/sendEmail');
const cloudinary = require('../config/cloudinary');
const streamifier = require('streamifier');

// Google OAuth client for verifying ID tokens from the frontend
const googleClientId = process.env.GOOGLE_CLIENT_ID;
const googleClient = googleClientId ? new OAuth2Client(googleClientId) : null;

// Register a new user
exports.registerUser = async (req, res, next) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Name, email and password are required' });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      if (existingUser.provider === 'google') {
        return res.status(400).json({
          message: 'This email is already linked to a Google account. Please sign in with Google.',
          code: 'GOOGLE_ACCOUNT',
        });
      }
      return res.status(400).json({ message: 'User already exists with this email' });
    }

    // Generate email verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    const user = await User.create({
      name,
      email,
      password,
      emailVerified: false,
      emailVerificationToken: verificationToken,
      emailVerificationExpires: verificationExpires,
    });

    // Send verification email
    const verificationLink = `${process.env.CLIENT_URL}/verify-email?token=${verificationToken}`;
    sendEmailVerificationEmail({ email: user.email, name: user.name, verificationLink })
      .then(() => console.log(`[Email] Verification email sent to ${user.email}`))
      .catch((err) => console.error('[Email] Verification email failed:', err.message));

    return res.status(201).json({
      message: 'Registration successful! Please check your email to verify your account.',
      requiresVerification: true,
      email: user.email,
    });
  } catch (error) {
    next(error);
  }
};

// Login user
exports.loginUser = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    if (user.isBlocked) {
      return res.status(403).json({ message: 'Your account is blocked. Contact support.' });
    }

    // Google-only accounts have no usable password — guide them to Google login
    if (user.provider === 'google') {
      return res.status(400).json({
        message: 'This account was created with Google Sign-In. Please use "Continue with Google" to log in.',
        code: 'GOOGLE_ACCOUNT',
      });
    }

    const isMatch = await user.matchPassword(password);

    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    // Block login if email is not verified (local accounts only)
    if (!user.emailVerified && user.provider !== 'google') {
      return res.status(403).json({
        message: 'Please verify your email address before logging in.',
        code: 'EMAIL_NOT_VERIFIED',
        email: user.email,
      });
    }

    const token = generateToken(user._id, user.role);

    return res.json({
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Get logged-in user profile
exports.getProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).select('-password');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    return res.json(user);
  } catch (error) {
    next(error);
  }
};

// Update logged-in user profile
exports.updateProfile = async (req, res, next) => {
  try {
    const { name, email, password } = req.body;

    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (name) user.name = name;
    if (email) user.email = email;
    if (password) user.password = password; // will be hashed by pre-save hook

    const updatedUser = await user.save();

    return res.json({
      message: 'Profile updated successfully',
      user: {
        id: updatedUser._id,
        name: updatedUser.name,
        email: updatedUser.email,
        role: updatedUser.role,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Upload profile image to Cloudinary
exports.uploadProfileImage = async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });

    const streamUpload = () =>
      new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          { folder: 'electrical-shop/profiles', transformation: [{ width: 400, height: 400, crop: 'fill' }] },
          (error, result) => {
            if (result) resolve(result);
            else reject(error);
          }
        );
        streamifier.createReadStream(req.file.buffer).pipe(stream);
      });

    const result = await streamUpload();

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { profileImage: result.secure_url },
      { new: true }
    ).select('-password');

    return res.json({ message: 'Profile image updated', profileImage: user.profileImage, user });
  } catch (error) {
    next(error);
  }
};

// Send OTP to logged-in user's email to verify identity before changing password
exports.sendChangePasswordOtp = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    if (user.provider === 'google') {
      return res.status(400).json({
        message: 'Google accounts do not have a password.',
        code: 'GOOGLE_ACCOUNT',
      });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    user.resetPasswordOtp = otp;
    user.resetPasswordOtpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 min
    await user.save();

    sendForgotPasswordOtpEmail({ email: user.email, name: user.name, otp }).catch(() => {});

    return res.json({ message: 'OTP sent to your registered email address.' });
  } catch (error) {
    next(error);
  }
};

// Change password (requires OTP verification + current password)
exports.changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword, otp } = req.body;

    if (!otp || !currentPassword || !newPassword) {
      return res.status(400).json({ message: 'OTP, current password and new password are required' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ message: 'New password must be at least 6 characters' });
    }

    const user = await User.findById(req.user._id).select('+resetPasswordOtp +resetPasswordOtpExpires');
    if (!user) return res.status(404).json({ message: 'User not found' });

    if (user.provider === 'google') {
      return res.status(400).json({
        message: 'Google accounts do not have a password. You sign in using Google.',
        code: 'GOOGLE_ACCOUNT',
      });
    }

    if (!user.resetPasswordOtp || user.resetPasswordOtp !== otp) {
      return res.status(400).json({ message: 'Invalid OTP. Please request a new one.' });
    }
    if (user.resetPasswordOtpExpires < new Date()) {
      return res.status(400).json({ message: 'OTP has expired. Please request a new one.' });
    }

    const isMatch = await user.matchPassword(currentPassword);
    if (!isMatch) return res.status(401).json({ message: 'Current password is incorrect' });

    user.resetPasswordOtp = undefined;
    user.resetPasswordOtpExpires = undefined;
    user.password = newPassword; // hashed by pre-save hook
    await user.save();

    return res.json({ message: 'Password changed successfully' });
  } catch (error) {
    next(error);
  }
};

// Get addresses of logged-in user
exports.getAddresses = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).select('addresses');
    return res.json(user.addresses || []);
  } catch (error) {
    next(error);
  }
};

// Add new address
exports.addAddress = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    user.addresses.push(req.body);

    if (user.addresses.length === 1) {
      user.addresses[0].isDefault = true;
    }

    await user.save();

    return res.status(201).json({ message: 'Address added', addresses: user.addresses });
  } catch (error) {
    next(error);
  }
};

// Update existing address
exports.updateAddress = async (req, res, next) => {
  try {
    const { addressId } = req.params;
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const address = user.addresses.id(addressId);
    if (!address) {
      return res.status(404).json({ message: 'Address not found' });
    }

    Object.assign(address, req.body);

    await user.save();

    return res.json({ message: 'Address updated', addresses: user.addresses });
  } catch (error) {
    next(error);
  }
};

// Delete address
exports.deleteAddress = async (req, res, next) => {
  try {
    const { addressId } = req.params;
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const address = user.addresses.id(addressId);
    if (!address) {
      return res.status(404).json({ message: 'Address not found' });
    }

    const wasDefault = address.isDefault;

    address.deleteOne();

    if (wasDefault && user.addresses.length > 0) {
      user.addresses[0].isDefault = true;
    }

    await user.save();

    return res.json({ message: 'Address deleted', addresses: user.addresses });
  } catch (error) {
    next(error);
  }
};

// Set default address
exports.setDefaultAddress = async (req, res, next) => {
  try {
    const { addressId } = req.params;
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const address = user.addresses.id(addressId);
    if (!address) {
      return res.status(404).json({ message: 'Address not found' });
    }

    user.addresses.forEach((addr) => {
      addr.isDefault = addr._id.toString() === addressId;
    });

    await user.save();

    return res.json({ message: 'Default address set', addresses: user.addresses });
  } catch (error) {
    next(error);
  }
};

// Forgot password — send OTP to email
exports.forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: 'Email is required' });

    const user = await User.findOne({ email: email.toLowerCase().trim() });

    if (!user) {
      return res.status(404).json({ message: 'This email is not registered.' });
    }

    if (user.provider === 'google') {
      return res.status(400).json({
        message: 'This account uses Google Sign-In. Please use "Continue with Google" to log in.',
      });
    }

    // Generate 6-digit OTP valid for 10 minutes
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    user.resetPasswordOtp = otp;
    user.resetPasswordOtpExpires = new Date(Date.now() + 10 * 60 * 1000);
    await user.save();

    // Fire-and-forget
    sendForgotPasswordOtpEmail({ email: user.email, name: user.name, otp })
      .then(() => console.log(`[Email] Password reset OTP sent to ${user.email}`))
      .catch((err) => console.error('[Email] Password reset OTP failed:', err.message));

    return res.json({ message: 'OTP has been sent to your email.' });
  } catch (error) {
    next(error);
  }
};

// Verify OTP — checks OTP is valid without consuming it
exports.verifyOtp = async (req, res, next) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ message: 'Email and OTP are required' });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() })
      .select('+resetPasswordOtp +resetPasswordOtpExpires');

    if (!user || !user.resetPasswordOtp) {
      return res.status(400).json({ message: 'Invalid OTP. Please try again.' });
    }

    if (user.resetPasswordOtpExpires < new Date()) {
      return res.status(400).json({ message: 'OTP expired. Request a new code.' });
    }

    if (user.resetPasswordOtp !== otp) {
      return res.status(400).json({ message: 'Invalid OTP. Please try again.' });
    }

    return res.json({ message: 'OTP verified successfully.' });
  } catch (error) {
    next(error);
  }
};

// Reset password — verify OTP + set new password in one step
exports.resetPassword = async (req, res, next) => {
  try {
    const { email, otp, password } = req.body;

    if (!email || !otp || !password) {
      return res.status(400).json({ message: 'Email, OTP and new password are required' });
    }
    if (password.length < 8) {
      return res.status(400).json({ message: 'Password must be at least 8 characters' });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() })
      .select('+resetPasswordOtp +resetPasswordOtpExpires');

    if (!user) {
      return res.status(400).json({ message: 'Invalid or expired OTP' });
    }

    if (
      !user.resetPasswordOtp ||
      !user.resetPasswordOtpExpires ||
      user.resetPasswordOtp !== otp ||
      user.resetPasswordOtpExpires < new Date()
    ) {
      return res.status(400).json({ message: 'Invalid or expired OTP' });
    }

    user.password = password;
    user.resetPasswordOtp = undefined;
    user.resetPasswordOtpExpires = undefined;
    await user.save();

    return res.json({ message: 'Password reset successful. You can now log in.' });
  } catch (error) {
    next(error);
  }
};

// Verify email via token from the verification link
exports.verifyEmail = async (req, res, next) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ message: 'Verification token is required' });

    const user = await User.findOne({ emailVerificationToken: token });

    if (!user) {
      return res.status(400).json({ message: 'Invalid verification link.' });
    }

    if (user.emailVerified) {
      return res.json({ message: 'Email already verified. You can log in.' });
    }

    if (user.emailVerificationExpires < new Date()) {
      return res.status(400).json({
        message: 'Verification link has expired.',
        code: 'TOKEN_EXPIRED',
        email: user.email,
      });
    }

    user.emailVerified = true;
    user.emailVerificationToken = undefined;
    user.emailVerificationExpires = undefined;
    await user.save();

    // Send welcome email now that they have verified
    sendEmail({
      to: user.email,
      subject: 'Welcome to Sri Murugan Electricals & Hardwares! ⚡',
      html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;"><h2 style="color:#003566;">Email verified! Welcome, ${user.name} ⚡</h2><p>Your account is now active. Start exploring our range of genuine electrical and hardware products.</p><a href="${process.env.CLIENT_URL}/products" style="background:#003566;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block;margin-top:12px;">Start Shopping</a></div>`,
    }).catch(() => {});

    return res.json({ message: 'Email verified successfully! You can now log in.' });
  } catch (error) {
    next(error);
  }
};

// Resend verification email
exports.resendVerification = async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: 'Email is required' });

    const user = await User.findOne({ email: email.toLowerCase().trim() });

    if (!user) return res.status(404).json({ message: 'No account found with this email.' });

    if (user.emailVerified) {
      return res.status(400).json({ message: 'This email is already verified.' });
    }

    if (user.provider === 'google') {
      return res.status(400).json({ message: 'Google accounts do not require email verification.' });
    }

    // Generate a fresh token
    const newToken = crypto.randomBytes(32).toString('hex');
    user.emailVerificationToken = newToken;
    user.emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await user.save();

    const verificationLink = `${process.env.CLIENT_URL}/verify-email?token=${newToken}`;
    sendEmailVerificationEmail({ email: user.email, name: user.name, verificationLink })
      .then(() => console.log(`[Email] Resent verification email to ${user.email}`))
      .catch((err) => console.error('[Email] Resend verification failed:', err.message));

    return res.json({ message: 'Verification email resent. Please check your inbox.' });
  } catch (error) {
    next(error);
  }
};

// Admin: get all users
exports.getAllUsers = async (req, res, next) => {
  try {
    const users = await User.find().select('-password');
    return res.json(users);
  } catch (error) {
    next(error);
  }
};

// Admin: block user
exports.blockUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    const user = await User.findById(id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    user.isBlocked = true;
    await user.save();

    return res.json({ message: 'User blocked successfully' });
  } catch (error) {
    next(error);
  }
};

// Admin: unblock user
exports.unblockUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    const user = await User.findById(id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    user.isBlocked = false;
    await user.save();

    return res.json({ message: 'User unblocked successfully' });
  } catch (error) {
    next(error);
  }
};

// Login or register using Google ID token
exports.googleLogin = async (req, res, next) => {
  try {
    const { token } = req.body;

    if (!googleClient) {
      return res.status(503).json({ message: 'Google login is not configured on the server' });
    }

    if (!token) {
      return res.status(400).json({ message: 'Google ID token is required' });
    }

    const ticket = await googleClient.verifyIdToken({
      idToken: token,
      audience: googleClientId,
    });

    const payload = ticket.getPayload();

    if (!payload || !payload.email) {
      return res.status(400).json({ message: 'Unable to retrieve Google account information' });
    }

    if (payload.email_verified === false) {
      return res.status(400).json({ message: 'Google email is not verified' });
    }

    const { email, name, sub: googleId } = payload;

    let user = await User.findOne({ email });

    if (!user) {
      // Create a new user linked to Google — Google already verifies the email.
      const randomPassword = crypto.randomBytes(32).toString('hex');
      user = await User.create({
        name: name || email,
        email,
        password: randomPassword,
        provider: 'google',
        googleId,
        emailVerified: true,
      });

      // Send welcome email for new Google sign-ups
      sendEmail({
        to: user.email,
        subject: 'Welcome to Sri Murugan Electricals & Hardwares! ⚡',
        html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;"><h2 style="color:#003566;">Welcome, ${user.name}! ⚡</h2><p>Thank you for joining Sri Murugan Electricals &amp; Hardwares via Google.</p><p>Start exploring our range of genuine electrical and hardware products.</p><a href="${process.env.CLIENT_URL}/products" style="background:#003566;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block;margin-top:12px;">Start Shopping</a></div>`,
      }).catch(() => {});
    } else {
      // Existing user: ensure they are not blocked and, if created locally,
      // keep them usable while still allowing Google login.
      if (user.isBlocked) {
        return res.status(403).json({ message: 'Your account is blocked. Contact support.' });
      }

      if (!user.googleId) {
        user.googleId = googleId;
        await user.save();
      }
    }

    const jwtToken = generateToken(user._id, user.role);

    return res.json({
      message: 'Login with Google successful',
      token: jwtToken,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    next(error);
  }
};
