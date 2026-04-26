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
        COUNT(CASE WHEN a.payment_status_id = 2 THEN 1 END) as paid_count,
        COALESCE(SUM(CASE WHEN a.payment_status_id = 2 THEN a.amount_paid END), 0) as total_collected,
        COUNT(CASE WHEN a.payment_status_id = 1 THEN 1 END) * e.price_per_head as total_pending
      FROM events e
      LEFT JOIN join_requests a ON e.id = a.event_id AND a.status = 'approved'
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

  static async deleteEvent(eventId: string) {
    const sql = 'DELETE FROM events WHERE id = ?';
    return await Database.query(sql, [eventId]);
  }
}

// Database functions for attendees (now mapped to join_requests table)
export class AttendeeService {
  static async getAttendeesByEvent(eventId: string) {
    const sql = `
      SELECT a.*, a.phone as contact_number, ps.status_name as payment_status
      FROM join_requests a
      JOIN payment_status ps ON a.payment_status_id = ps.id
      WHERE a.event_id = ? AND a.status = 'approved'
      ORDER BY a.created_at DESC
    `;
    return await Database.query(sql, [eventId]);
  }

  static async createAttendee(eventId: string, attendeeData: {
    student_name: string;
    contact_number?: string;
    payment_status_id?: number;
    amount_paid?: number;
    payment_slip_url?: string;
  }) {
    const sql = `
      INSERT INTO join_requests (event_id, student_name, phone, status, payment_status_id, amount_paid, payment_slip_url)
      VALUES (?, ?, ?, 'approved', ?, ?, ?)
    `;
    return await Database.query(sql, [
      eventId,
      attendeeData.student_name,
      attendeeData.contact_number || null,
      attendeeData.payment_status_id || 1,
      attendeeData.amount_paid || 0,
      attendeeData.payment_slip_url || null
    ]);
  }

  static async updateAttendeeStatus(attendeeId: string, paymentStatusId: number, amountPaid: number) {
    const sql = 'UPDATE join_requests SET payment_status_id = ?, amount_paid = ? WHERE id = ?';
    return await Database.query(sql, [paymentStatusId, amountPaid, attendeeId]);
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
      INSERT INTO join_requests (event_id, student_name, email, phone, note, payment_slip_url, status, payment_status_id, amount_paid)
      VALUES (?, ?, ?, ?, ?, ?, 'pending', 1, 0)
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
    const requests = await Database.query('SELECT * FROM join_requests WHERE id = ?', [requestId]);
    if (!Array.isArray(requests) || requests.length === 0) {
      throw new Error('Join request not found');
    }

    const request = requests[0];
    const events = await Database.query('SELECT price_per_head FROM events WHERE id = ?', [request.event_id]);
    const pricePerHead = (Array.isArray(events) && events.length > 0) ? events[0].price_per_head : 0;

    await Database.query(
      "UPDATE join_requests SET status = 'approved', payment_status_id = 2, amount_paid = ? WHERE id = ?",
      [pricePerHead, requestId]
    );
  }

  static async rejectJoinRequest(requestId: string) {
    await this.updateJoinRequestStatus(requestId, 'rejected');
  }
}