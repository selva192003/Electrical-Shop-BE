const SupportTicket = require('../models/SupportTicket');
const { createNotification } = require('./notificationController');

// POST /api/support  — create ticket (user)
exports.createTicket = async (req, res, next) => {
  try {
    const { subject, description, category, relatedOrder } = req.body;

    if (!subject || !description) {
      return res.status(400).json({ message: 'Subject and description are required' });
    }

    const ticket = await SupportTicket.create({
      user: req.user._id,
      subject,
      description,
      category,
      relatedOrder: relatedOrder || undefined,
    });

    await createNotification({
      userId: req.user._id,
      title: 'Support Ticket Created',
      message: `Your support ticket "#${ticket._id}" has been submitted. We will respond shortly.`,
      type: 'support',
      link: '/support/tickets',
    });

    return res.status(201).json(ticket);
  } catch (error) {
    next(error);
  }
};

// GET /api/support  — get own tickets (user)
exports.getMyTickets = async (req, res, next) => {
  try {
    const tickets = await SupportTicket.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .select('-replies');

    return res.json(tickets);
  } catch (error) {
    next(error);
  }
};

// GET /api/support/:id  — get single ticket (user or admin)
exports.getTicket = async (req, res, next) => {
  try {
    const ticket = await SupportTicket.findById(req.params.id).populate('user', 'name email');

    if (!ticket) return res.status(404).json({ message: 'Ticket not found' });

    // regular user may only see own tickets
    if (req.user.role !== 'admin' && ticket.user._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    return res.json(ticket);
  } catch (error) {
    next(error);
  }
};

// POST /api/support/:id/reply  — reply (user or admin)
exports.replyToTicket = async (req, res, next) => {
  try {
    const { message } = req.body;

    if (!message) return res.status(400).json({ message: 'Reply message is required' });

    const ticket = await SupportTicket.findById(req.params.id);
    if (!ticket) return res.status(404).json({ message: 'Ticket not found' });

    const sender = req.user.role === 'admin' ? 'admin' : 'user';

    if (sender === 'user' && ticket.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    ticket.replies.push({ sender, message });

    if (sender === 'admin') {
      // First admin reply moves ticket to in_progress
      if (ticket.status === 'open') {
        ticket.status = 'in_progress';
      }
      // Admin replying to a resolved ticket re-opens it
      if (ticket.status === 'resolved' || ticket.status === 'closed') {
        ticket.status = 'in_progress';
      }
    }

    if (sender === 'user') {
      // User following up on a resolved/closed ticket re-opens it
      if (ticket.status === 'resolved' || ticket.status === 'closed') {
        ticket.status = 'in_progress';
      }
    }

    await ticket.save();

    // Notify the recipient
    if (sender === 'admin') {
      await createNotification({
        userId: ticket.user,
        title: 'Support Reply Received',
        message: `The support team replied to your ticket: "${ticket.subject}"`,
        type: 'support',
        link: `/support/tickets/${ticket._id}`,
      });
    }

    return res.json(ticket);
  } catch (error) {
    next(error);
  }
};

// PATCH /api/support/:id/status  — update status (admin)
exports.updateTicketStatus = async (req, res, next) => {
  try {
    const { status } = req.body;

    // Validate before touching the DB
    const ALLOWED_STATUSES = ['open', 'in_progress', 'resolved'];
    if (!ALLOWED_STATUSES.includes(status)) {
      return res.status(400).json({ message: `Invalid status. Allowed values: ${ALLOWED_STATUSES.join(', ')}` });
    }

    const ticket = await SupportTicket.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true, runValidators: true }
    );

    if (!ticket) return res.status(404).json({ message: 'Ticket not found' });

    if (status === 'resolved') {
      await createNotification({
        userId: ticket.user,
        title: 'Support Ticket Resolved',
        message: `Your ticket "${ticket.subject}" has been resolved. If you need further help, you can raise a new ticket.`,
        type: 'support',
        link: `/support/tickets/${ticket._id}`,
      });
    }

    return res.json(ticket);
  } catch (error) {
    next(error);
  }
};

// GET /api/support/admin/pending-count  — count tickets needing admin attention
exports.getPendingCount = async (req, res, next) => {
  try {
    // 1. All open tickets (new — admin hasn't touched yet)
    const openCount = await SupportTicket.countDocuments({ status: 'open' });

    // 2. In-progress tickets where the LAST reply came from the user (user replied, waiting for admin)
    const inProgressTickets = await SupportTicket.find(
      { status: 'in_progress', 'replies.0': { $exists: true } },
      { replies: 1 }
    ).lean();

    const userRepliedCount = inProgressTickets.filter((t) => {
      const last = t.replies[t.replies.length - 1];
      return last && last.sender === 'user';
    }).length;

    return res.json({ count: openCount + userRepliedCount });
  } catch (error) {
    next(error);
  }
};

// GET /api/support/admin/all  — all tickets (admin)
exports.getAllTickets = async (req, res, next) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const filter = status ? { status } : {};

    const [tickets, total] = await Promise.all([
      SupportTicket.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(Number(limit))
        .populate('user', 'name email')
        .select('-replies'),
      SupportTicket.countDocuments(filter),
    ]);

    return res.json({ tickets, total, page: Number(page), pages: Math.ceil(total / limit) });
  } catch (error) {
    next(error);
  }
};
