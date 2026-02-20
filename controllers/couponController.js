const Coupon = require('../models/Coupon');

// POST /api/coupons/validate  — user validates a coupon code
exports.validateCoupon = async (req, res, next) => {
  try {
    const { code, orderAmount } = req.body;

    if (!code) return res.status(400).json({ message: 'Coupon code is required' });

    const coupon = await Coupon.findOne({ code: code.toUpperCase().trim() });

    if (!coupon) return res.status(404).json({ message: 'Invalid coupon code' });
    if (!coupon.isActive) return res.status(400).json({ message: 'This coupon is no longer active' });
    if (coupon.expiresAt < new Date()) return res.status(400).json({ message: 'This coupon has expired' });
    if (coupon.usageLimit !== null && coupon.usedCount >= coupon.usageLimit) {
      return res.status(400).json({ message: 'This coupon has reached its usage limit' });
    }

    // Per-user limit check
    const userUsageCount = coupon.usedBy.filter(id => id.toString() === req.user._id.toString()).length;
    if (userUsageCount >= coupon.perUserLimit) {
      return res.status(400).json({ message: 'You have already used this coupon' });
    }

    const amount = Number(orderAmount) || 0;
    if (amount < coupon.minOrderAmount) {
      return res.status(400).json({
        message: `Minimum order amount of ₹${coupon.minOrderAmount} required for this coupon`,
      });
    }

    // Calculate discount
    let discountAmount = 0;
    if (coupon.discountType === 'percentage') {
      discountAmount = (amount * coupon.discountValue) / 100;
      if (coupon.maxDiscountAmount) {
        discountAmount = Math.min(discountAmount, coupon.maxDiscountAmount);
      }
    } else {
      discountAmount = coupon.discountValue;
    }
    discountAmount = Math.min(discountAmount, amount); // cannot exceed order

    return res.json({
      valid: true,
      couponId: coupon._id,
      code: coupon.code,
      discountType: coupon.discountType,
      discountValue: coupon.discountValue,
      discountAmount: parseFloat(discountAmount.toFixed(2)),
      description: coupon.description,
    });
  } catch (error) {
    next(error);
  }
};

// POST /api/coupons/apply  — mark coupon as used after order
exports.applyCoupon = async (req, res, next) => {
  try {
    const { couponId } = req.body;

    const coupon = await Coupon.findById(couponId);
    if (!coupon) return res.status(404).json({ message: 'Coupon not found' });

    coupon.usedBy.push(req.user._id);
    coupon.usedCount += 1;
    await coupon.save();

    return res.json({ message: 'Coupon applied successfully' });
  } catch (error) {
    next(error);
  }
};

// ---- Admin endpoints ----

// GET /api/coupons  — list all coupons (admin)
exports.getAllCoupons = async (req, res, next) => {
  try {
    const coupons = await Coupon.find().sort({ createdAt: -1 }).select('-usedBy');
    return res.json(coupons);
  } catch (error) {
    next(error);
  }
};

// POST /api/coupons  — create coupon (admin)
exports.createCoupon = async (req, res, next) => {
  try {
    const {
      code, description, discountType, discountValue,
      minOrderAmount, maxDiscountAmount, usageLimit, perUserLimit, expiresAt,
    } = req.body;

    if (!code || !discountType || !discountValue || !expiresAt) {
      return res.status(400).json({ message: 'code, discountType, discountValue and expiresAt are required' });
    }

    const existing = await Coupon.findOne({ code: code.toUpperCase().trim() });
    if (existing) return res.status(400).json({ message: 'Coupon code already exists' });

    const coupon = await Coupon.create({
      code, description, discountType, discountValue,
      minOrderAmount, maxDiscountAmount, usageLimit, perUserLimit, expiresAt,
    });

    return res.status(201).json(coupon);
  } catch (error) {
    next(error);
  }
};

// PUT /api/coupons/:id  — update coupon (admin)
exports.updateCoupon = async (req, res, next) => {
  try {
    const coupon = await Coupon.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!coupon) return res.status(404).json({ message: 'Coupon not found' });
    return res.json(coupon);
  } catch (error) {
    next(error);
  }
};

// DELETE /api/coupons/:id  — delete coupon (admin)
exports.deleteCoupon = async (req, res, next) => {
  try {
    const coupon = await Coupon.findByIdAndDelete(req.params.id);
    if (!coupon) return res.status(404).json({ message: 'Coupon not found' });
    return res.json({ message: 'Coupon deleted' });
  } catch (error) {
    next(error);
  }
};
