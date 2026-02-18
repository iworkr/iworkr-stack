/// Quote model — mirrors Supabase `quotes` table.
class Quote {
  final String id;
  final String organizationId;
  final String? displayId;
  final String? clientId;
  final String? jobId;
  final String? clientName;
  final String? clientEmail;
  final String? clientAddress;
  final String status; // draft, sent, viewed, accepted, rejected, expired
  final String? title;
  final DateTime? issueDate;
  final DateTime? validUntil;
  final double subtotal;
  final double taxRate;
  final double tax;
  final double total;
  final String? terms;
  final String? notes;
  final String? signatureUrl;
  final DateTime? signedAt;
  final String? signedBy;
  final String? invoiceId;
  final String? createdBy;
  final DateTime createdAt;
  final List<QuoteLineItem> lineItems;

  const Quote({
    required this.id,
    required this.organizationId,
    this.displayId,
    this.clientId,
    this.jobId,
    this.clientName,
    this.clientEmail,
    this.clientAddress,
    required this.status,
    this.title,
    this.issueDate,
    this.validUntil,
    required this.subtotal,
    required this.taxRate,
    required this.tax,
    required this.total,
    this.terms,
    this.notes,
    this.signatureUrl,
    this.signedAt,
    this.signedBy,
    this.invoiceId,
    this.createdBy,
    required this.createdAt,
    this.lineItems = const [],
  });

  bool get isDraft => status == 'draft';
  bool get isSent => status == 'sent';
  bool get isAccepted => status == 'accepted';
  bool get isRejected => status == 'rejected';
  bool get canPresent => status == 'draft' || status == 'sent';
  bool get isSigned => signatureUrl != null && signatureUrl!.isNotEmpty;

  factory Quote.fromJson(Map<String, dynamic> json, {List<QuoteLineItem>? items}) {
    return Quote(
      id: json['id'] as String,
      organizationId: json['organization_id'] as String,
      displayId: json['display_id'] as String?,
      clientId: json['client_id'] as String?,
      jobId: json['job_id'] as String?,
      clientName: json['client_name'] as String?,
      clientEmail: json['client_email'] as String?,
      clientAddress: json['client_address'] as String?,
      status: json['status'] as String? ?? 'draft',
      title: json['title'] as String?,
      issueDate: json['issue_date'] != null ? DateTime.tryParse(json['issue_date'] as String) : null,
      validUntil: json['valid_until'] != null ? DateTime.tryParse(json['valid_until'] as String) : null,
      subtotal: _toDouble(json['subtotal']),
      taxRate: _toDouble(json['tax_rate']),
      tax: _toDouble(json['tax']),
      total: _toDouble(json['total']),
      terms: json['terms'] as String?,
      notes: json['notes'] as String?,
      signatureUrl: json['signature_url'] as String?,
      signedAt: json['signed_at'] != null ? DateTime.tryParse(json['signed_at'] as String) : null,
      signedBy: json['signed_by'] as String?,
      invoiceId: json['invoice_id'] as String?,
      createdBy: json['created_by'] as String?,
      createdAt: DateTime.tryParse(json['created_at'] as String? ?? '') ?? DateTime.now(),
      lineItems: items ?? [],
    );
  }

  static double _toDouble(dynamic v) {
    if (v == null) return 0.0;
    if (v is double) return v;
    if (v is int) return v.toDouble();
    if (v is String) return double.tryParse(v) ?? 0.0;
    return 0.0;
  }
}

/// Line item on a quote
class QuoteLineItem {
  final String? id;
  final String? quoteId;
  final String description;
  final double quantity;
  final double unitPrice;
  final double? taxRate;
  final int sortOrder;

  const QuoteLineItem({
    this.id,
    this.quoteId,
    required this.description,
    required this.quantity,
    required this.unitPrice,
    this.taxRate,
    this.sortOrder = 0,
  });

  double get lineTotal => quantity * unitPrice;

  factory QuoteLineItem.fromJson(Map<String, dynamic> json) {
    return QuoteLineItem(
      id: json['id'] as String?,
      quoteId: json['quote_id'] as String?,
      description: json['description'] as String? ?? '',
      quantity: Quote._toDouble(json['quantity']),
      unitPrice: Quote._toDouble(json['unit_price']),
      taxRate: json['tax_rate'] != null ? Quote._toDouble(json['tax_rate']) : null,
      sortOrder: json['sort_order'] as int? ?? 0,
    );
  }

  Map<String, dynamic> toJson() => {
    'description': description,
    'quantity': quantity,
    'unit_price': unitPrice,
    if (taxRate != null) 'tax_rate': taxRate,
    'sort_order': sortOrder,
  };
}
