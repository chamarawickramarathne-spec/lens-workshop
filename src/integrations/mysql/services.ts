import { Database } from './client';

// Database functions for events
export class EventService {
  static async getEventsByUser(userId: string) {
    const sql = `
      SELECT
        e.id,
        e.event_name,
        e.event_date,
        e.price_per_head,
        e.max_students,
        e.location,
        e.image_url,
        e.for_whom,
        e.end_date,
        COUNT(a.id) as attendees_count,
        COUNT(CASE WHEN a.status = 'approved' THEN 1 END) as approved_count,
        COALESCE(SUM(CASE WHEN a.status = 'approved' THEN e.price_per_head ELSE 0 END), 0) as total_collected,
        COUNT(CASE WHEN a.status = 'pending' THEN 1 END) * e.price_per_head as total_pending
      FROM events e
      LEFT JOIN join_requests a ON e.id = a.event_id
      WHERE e.user_id = ?
      GROUP BY e.id, e.event_name, e.event_date, e.price_per_head, e.max_students, e.location, e.image_url, e.for_whom, e.end_date
      ORDER BY e.event_date DESC
    `;
    return await Database.query(sql, [userId]);
  }

  static async createEvent(userId: string, eventData: {
    event_name: string;
    event_date: string;
    price_per_head: number;
    max_students: number;
    notes?: string;
    location?: string;
    image_url?: string;
    for_whom?: string;
    end_date?: string;
  }) {
    const sql = `
      INSERT INTO events (user_id, event_name, event_date, price_per_head, max_students, notes, location, image_url, for_whom, end_date)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    return await Database.query(sql, [
      userId,
      eventData.event_name,
      eventData.event_date,
      eventData.price_per_head,
      eventData.max_students,
      eventData.notes || null,
      eventData.location || null,
      eventData.image_url || null,
      eventData.for_whom || null,
      eventData.end_date || null
    ]);
  }

  static async getEventById(eventId: string) {
    const sql = 'SELECT * FROM events WHERE id = ?';
    const result = await Database.query(sql, [eventId]);
    return Array.isArray(result) ? result[0] : null;
  }

  static async getPublicEvents() {
    const sql = 'SELECT id, event_name, event_date, end_date, price_per_head, notes, location, image_url, for_whom FROM events ORDER BY event_date DESC';
    return await Database.query(sql);
  }

  static async updateEvent(eventId: string, eventData: {
    event_name: string;
    event_date: string;
    end_date?: string;
    price_per_head: number;
    max_students: number;
    notes?: string;
    location?: string;
    image_url?: string;
    for_whom?: string;
  }) {
    const sql = `
      UPDATE events SET
        event_name = ?,
        event_date = ?,
        end_date = ?,
        price_per_head = ?,
        max_students = ?,
        notes = ?,
        location = ?,
        image_url = ?,
        for_whom = ?
      WHERE id = ?
    `;
    return await Database.query(sql, [
      eventData.event_name,
      eventData.event_date,
      eventData.end_date || null,
      eventData.price_per_head,
      eventData.max_students,
      eventData.notes || null,
      eventData.location || null,
      eventData.image_url || null,
      eventData.for_whom || null,
      eventId
    ]);
  }

  static async deleteEvent(eventId: string) {
    const sql = 'DELETE FROM events WHERE id = ?';
    return await Database.query(sql, [eventId]);
  }
}

// Database functions for attendees (now mapped to join_requests table)
export class AttendeeService {
  static async getAttendeesByEvent(eventId: string) {
    const sql = `
      SELECT id, student_name, email, phone as contact_number, status, payment_slip_url, note, created_at
      FROM join_requests
      WHERE event_id = ? AND status = 'approved'
      ORDER BY created_at DESC
    `;
    return await Database.query(sql, [eventId]);
  }

  static async createAttendee(eventId: string, attendeeData: {
    student_name: string;
    contact_number?: string;
    payment_slip_url?: string;
  }) {
    const sql = `
      INSERT INTO join_requests (event_id, student_name, phone, status, payment_slip_url)
      VALUES (?, ?, ?, 'approved', ?)
    `;
    return await Database.query(sql, [
      eventId,
      attendeeData.student_name,
      attendeeData.contact_number || null,
      attendeeData.payment_slip_url || null
    ]);
  }

  static async updateAttendeeStatus(attendeeId: string, status: string) {
    const sql = 'UPDATE join_requests SET status = ? WHERE id = ?';
    return await Database.query(sql, [status, attendeeId]);
  }

  static async deleteAttendee(attendeeId: string) {
    const sql = 'DELETE FROM join_requests WHERE id = ?';
    return await Database.query(sql, [attendeeId]);
  }
}

// Database functions for join requests
export class JoinRequestService {
  static async getJoinRequestsByEvent(eventId: string) {
    const sql = "SELECT * FROM join_requests WHERE event_id = ? AND status = 'pending' ORDER BY created_at DESC";
    return await Database.query(sql, [eventId]);
  }

  static async createJoinRequest(joinData: {
    event_id: string;
    student_name: string;
    email: string;
    phone: string;
    note?: string;
    payment_slip_url: string;
  }) {
    const sql = `
      INSERT INTO join_requests (event_id, student_name, email, phone, note, payment_slip_url, status)
      VALUES (?, ?, ?, ?, ?, ?, 'pending')
    `;
    return await Database.query(sql, [
      joinData.event_id,
      joinData.student_name,
      joinData.email,
      joinData.phone,
      joinData.note || null,
      joinData.payment_slip_url
    ]);
  }

  static async updateJoinRequestStatus(requestId: string, status: string) {
    const sql = 'UPDATE join_requests SET status = ? WHERE id = ?';
    return await Database.query(sql, [status, requestId]);
  }

  static async approveJoinRequest(requestId: string) {
    await Database.query(
      "UPDATE join_requests SET status = 'approved' WHERE id = ?",
      [requestId]
    );
  }

  static async rejectJoinRequest(requestId: string) {
    await this.updateJoinRequestStatus(requestId, 'rejected');
  }
}

// Database functions for reports
export class ReportService {
  static async getEarningsSummary(userId: string, period: 'week' | 'month' | 'year') {
    const dateFilter = period === 'week'
      ? "AND e.event_date >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)"
      : period === 'month'
        ? "AND e.event_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)"
        : "AND e.event_date >= DATE_SUB(CURDATE(), INTERVAL 365 DAY)";

    const sql = `
      SELECT
        COUNT(DISTINCT e.id) as total_workshops,
        COALESCE(SUM(CASE WHEN a.status = 'approved' THEN e.price_per_head ELSE 0 END), 0) as total_earned,
        COALESCE(COUNT(CASE WHEN a.status = 'approved' THEN 1 END), 0) as total_students,
        COALESCE(COUNT(CASE WHEN a.status = 'pending' THEN 1 END), 0) as pending_requests,
        COALESCE(SUM(CASE WHEN a.status = 'pending' THEN e.price_per_head END), 0) as pending_amount,
        COALESCE(COUNT(CASE WHEN a.status = 'approved' THEN 1 END), 0) as approved_students
      FROM events e
      LEFT JOIN join_requests a ON e.id = a.event_id
      WHERE e.user_id = ? ${dateFilter}
    `;
    const result = await Database.query(sql, [userId]);
    return Array.isArray(result) ? result[0] : null;
  }

  static async getEarningsOverTime(userId: string, period: 'week' | 'month' | 'year') {
    let groupBy: string, dateFormat: string, dateFilter: string;

    if (period === 'week') {
      groupBy = "DATE(e.event_date)";
      dateFormat = "%b %d";
      dateFilter = "AND e.event_date >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)";
    } else if (period === 'month') {
      groupBy = "DATE(e.event_date)";
      dateFormat = "%b %d";
      dateFilter = "AND e.event_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)";
    } else {
      groupBy = "DATE_FORMAT(e.event_date, '%Y-%m')";
      dateFormat = "%b %Y";
      dateFilter = "AND e.event_date >= DATE_SUB(CURDATE(), INTERVAL 365 DAY)";
    }

    const sql = `
      SELECT
        DATE_FORMAT(e.event_date, '${dateFormat}') as label,
        COALESCE(SUM(CASE WHEN a.status = 'approved' THEN e.price_per_head ELSE 0 END), 0) as earned,
        COUNT(CASE WHEN a.status = 'approved' THEN 1 END) as students
      FROM events e
      LEFT JOIN join_requests a ON e.id = a.event_id
      WHERE e.user_id = ? ${dateFilter}
      GROUP BY ${groupBy}, DATE_FORMAT(e.event_date, '${dateFormat}')
      ORDER BY MIN(e.event_date) ASC
    `;
    return await Database.query(sql, [userId]);
  }

  static async getWorkshopTypeBreakdown(userId: string, period: 'week' | 'month' | 'year') {
    const dateFilter = period === 'week'
      ? "AND e.event_date >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)"
      : period === 'month'
        ? "AND e.event_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)"
        : "AND e.event_date >= DATE_SUB(CURDATE(), INTERVAL 365 DAY)";

    const sql = `
      SELECT
        COALESCE(e.for_whom, 'General') as category,
        COUNT(DISTINCT e.id) as workshop_count,
        COUNT(CASE WHEN a.status = 'approved' THEN 1 END) as student_count,
        COALESCE(SUM(CASE WHEN a.status = 'approved' THEN e.price_per_head ELSE 0 END), 0) as earned
      FROM events e
      LEFT JOIN join_requests a ON e.id = a.event_id
      WHERE e.user_id = ? ${dateFilter}
      GROUP BY COALESCE(e.for_whom, 'General')
      ORDER BY student_count DESC
    `;
    return await Database.query(sql, [userId]);
  }

  static async getTopWorkshops(userId: string, period: 'week' | 'month' | 'year') {
    const dateFilter = period === 'week'
      ? "AND e.event_date >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)"
      : period === 'month'
        ? "AND e.event_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)"
        : "AND e.event_date >= DATE_SUB(CURDATE(), INTERVAL 365 DAY)";

    const sql = `
      SELECT
        e.id,
        e.event_name,
        e.for_whom,
        e.event_date,
        e.price_per_head,
        COUNT(CASE WHEN a.status = 'approved' THEN 1 END) as student_count,
        COALESCE(SUM(CASE WHEN a.status = 'approved' THEN e.price_per_head ELSE 0 END), 0) as earned
      FROM events e
      LEFT JOIN join_requests a ON e.id = a.event_id
      WHERE e.user_id = ? ${dateFilter}
      GROUP BY e.id, e.event_name, e.for_whom, e.event_date, e.price_per_head
      ORDER BY student_count DESC
      LIMIT 10
    `;
    return await Database.query(sql, [userId]);
  }
}

// Database functions for user profile
export class ProfileService {
  static async getFullProfile(userId: string) {
    const sql = `
      SELECT 
        u.id, u.email, u.created_at as member_since,
        p.display_name, p.phone, p.address, p.avatar_url,
        pkg.name as package_name, pkg.max_workshops, pkg.max_students_per_workshop, pkg.max_slip_size_mb, pkg.price as package_price
      FROM users u
      LEFT JOIN profiles p ON u.id = p.user_id
      LEFT JOIN packages pkg ON u.package_id = pkg.id
      WHERE u.id = ?
    `;
    const result = await Database.query(sql, [userId]);
    return Array.isArray(result) ? result[0] : null;
  }

  static async updateProfile(userId: string, data: {
    display_name?: string;
    phone?: string;
    address?: string;
    avatar_url?: string;
  }) {
    const sql = `
      UPDATE profiles SET 
        display_name = ?, phone = ?, address = ?, avatar_url = ?
      WHERE user_id = ?
    `;
    return await Database.query(sql, [
      data.display_name || null,
      data.phone || null,
      data.address || null,
      data.avatar_url || null,
      userId
    ]);
  }

  static async getAllUploadedFiles(userId: string) {
    const sql = `
      SELECT DISTINCT file_url FROM (
        SELECT image_url as file_url FROM events WHERE user_id = ? AND image_url IS NOT NULL AND image_url != ''
        UNION ALL
        SELECT jr.payment_slip_url as file_url FROM join_requests jr
        JOIN events e ON jr.event_id = e.id
        WHERE e.user_id = ? AND jr.payment_slip_url IS NOT NULL AND jr.payment_slip_url != ''
        UNION ALL
        SELECT avatar_url as file_url FROM profiles WHERE user_id = ? AND avatar_url IS NOT NULL AND avatar_url != ''
      ) all_files
    `;
    return await Database.query(sql, [userId, userId, userId]);
  }

  static async deleteAccount(userId: string) {
    // CASCADE will handle events, join_requests, profiles, sessions
    const sql = 'DELETE FROM users WHERE id = ?';
    return await Database.query(sql, [userId]);
  }
}