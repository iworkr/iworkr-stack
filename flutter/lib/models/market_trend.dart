/// Market trend — time-series pricing data for a service category.
class MarketTrend {
  final String id;
  final String serviceCategory;
  final String? serviceType;
  final String regionCode;
  final DateTime periodStart;
  final DateTime periodEnd;
  final double avgPrice;
  final double medianPrice;
  final double priceChangePct;
  final int volume;
  final double highPrice;
  final double lowPrice;

  const MarketTrend({
    required this.id,
    required this.serviceCategory,
    this.serviceType,
    required this.regionCode,
    required this.periodStart,
    required this.periodEnd,
    required this.avgPrice,
    required this.medianPrice,
    required this.priceChangePct,
    required this.volume,
    this.highPrice = 0,
    this.lowPrice = 0,
  });

  /// Whether the trend is positive (prices going up)
  bool get isUp => priceChangePct > 0;

  /// Whether the trend is negative (prices going down)
  bool get isDown => priceChangePct < 0;

  /// Formatted change percentage
  String get changeLabel {
    final sign = priceChangePct >= 0 ? '+' : '';
    return '$sign${priceChangePct.toStringAsFixed(1)}%';
  }

  /// Month label (e.g. "Jan", "Feb")
  String get monthLabel {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return months[periodStart.month - 1];
  }

  factory MarketTrend.fromJson(Map<String, dynamic> json) {
    return MarketTrend(
      id: json['id'] as String,
      serviceCategory: json['service_category'] as String,
      serviceType: json['service_type'] as String?,
      regionCode: json['region_code'] as String? ?? 'default',
      periodStart: DateTime.parse(json['period_start'] as String),
      periodEnd: DateTime.parse(json['period_end'] as String),
      avgPrice: _d(json['avg_price']),
      medianPrice: _d(json['median_price']),
      priceChangePct: _d(json['price_change_pct']),
      volume: json['volume'] as int? ?? 0,
      highPrice: _d(json['high_price']),
      lowPrice: _d(json['low_price']),
    );
  }

  static double _d(dynamic v) {
    if (v == null) return 0;
    if (v is double) return v;
    if (v is int) return v.toDouble();
    if (v is String) return double.tryParse(v) ?? 0;
    return 0;
  }
}
