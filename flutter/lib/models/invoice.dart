/// Invoice model — mirrors Supabase `invoices` table.
class Invoice {
  final String id;
  final String organizationId;
  final String? displayId;
  final String? clientId;
  final String? jobId;
  final String? clientName;
  final String? clientEmail;
  final String? clientAddress;
  final String status; // draft, sent, paid, overdue, voided
  final DateTime? issueDate;
  final DateTime? dueDate;
  final DateTime? paidDate;
  final double subtotal;
  final double taxRate;
  final double tax;
  final double total;
  final String? paymentLink;
  final String? notes;
  final DateTime createdAt;

  const Invoice({
    required this.id,
    required this.organizationId,
    this.displayId,
    this.clientId,
    this.jobId,
    this.clientName,
    this.clientEmail,
    this.clientAddress,
    required this.status,
    this.issueDate,
    this.dueDate,
    this.paidDate,
    required this.subtotal,
    required this.taxRate,
    required this.tax,
    required this.total,
    this.paymentLink,
    this.notes,
    required this.createdAt,
  });

  bool get isPaid => status == 'paid';
  bool get isOverdue => status == 'overdue';
  bool get isDraft => status == 'draft';
  bool get isPartiallyPaid => status == 'partially_paid';
  bool get isVoided => status == 'voided';
  bool get canCollect => status == 'sent' || status == 'overdue' || status == 'partially_paid';
  bool get isOutstanding => status == 'sent' || status == 'overdue' || status == 'partially_paid';

  String get statusLabel {
    switch (status) {
      case 'draft': return 'Draft';
      case 'sent': return 'Sent';
      case 'partially_paid': return 'Partial';
      case 'paid': return 'Paid';
      case 'overdue': return 'Overdue';
      case 'voided': return 'Void';
      default: return status;
    }
  }

  factory Invoice.fromJson(Map<String, dynamic> json) {
    return Invoice(
      id: json['id'] as String,
      organizationId: json['organization_id'] as String,
      displayId: json['display_id'] as String?,
      clientId: json['client_id'] as String?,
      jobId: json['job_id'] as String?,
      clientName: json['client_name'] as String?,
      clientEmail: json['client_email'] as String?,
      clientAddress: json['client_address'] as String?,
      status: json['status'] as String? ?? 'draft',
      issueDate: json['issue_date'] != null ? DateTime.tryParse(json['issue_date'] as String) : null,
      dueDate: json['due_date'] != null ? DateTime.tryParse(json['due_date'] as String) : null,
      paidDate: json['paid_date'] != null ? DateTime.tryParse(json['paid_date'] as String) : null,
      subtotal: _toDouble(json['subtotal']),
      taxRate: _toDouble(json['tax_rate']),
      tax: _toDouble(json['tax']),
      total: _toDouble(json['total']),
      paymentLink: json['payment_link'] as String?,
      notes: json['notes'] as String?,
      createdAt: DateTime.tryParse(json['created_at'] as String? ?? '') ?? DateTime.now(),
    );
  }

  static double _toDouble(dynamic value) {
    if (value == null) return 0.0;
    if (value is double) return value;
    if (value is int) return value.toDouble();
    if (value is String) return double.tryParse(value) ?? 0.0;
    return 0.0;
  }
}
