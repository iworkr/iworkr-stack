/// Market benchmark — precomputed pricing statistics for a service category + region.
class MarketBenchmark {
  final String id;
  final String serviceCategory;
  final String? serviceType;
  final String regionCode;
  final String period;
  final DateTime periodStart;
  final DateTime periodEnd;
  final int sampleSize;
  final double priceLow;
  final double priceP25;
  final double priceMedian;
  final double priceP75;
  final double priceHigh;
  final double priceAvg;
  final double priceStddev;
  final double winRateLow;
  final double winRateMedian;
  final double winRateHigh;
  final DateTime updatedAt;

  const MarketBenchmark({
    required this.id,
    required this.serviceCategory,
    this.serviceType,
    required this.regionCode,
    required this.period,
    required this.periodStart,
    required this.periodEnd,
    required this.sampleSize,
    required this.priceLow,
    required this.priceP25,
    required this.priceMedian,
    required this.priceP75,
    required this.priceHigh,
    required this.priceAvg,
    this.priceStddev = 0,
    this.winRateLow = 0,
    this.winRateMedian = 0,
    this.winRateHigh = 0,
    required this.updatedAt,
  });

  /// Whether we have enough data (>= 5 data points) for privacy threshold
  bool get hasEnoughData => sampleSize >= 5;

  /// Price range (high - low)
  double get priceRange => priceHigh - priceLow;

  /// Interquartile range
  double get iqr => priceP75 - priceP25;

  /// Calculate percentile for a given price
  double percentileFor(double price) {
    if (priceRange <= 0) return 50;
    final clamped = price.clamp(priceLow, priceHigh);
    return ((clamped - priceLow) / priceRange * 100).clamp(0, 100);
  }

  /// Calculate win probability for a given price (linear interpolation)
  double winProbabilityFor(double price) {
    if (price <= priceP25) return 90;
    if (price <= priceMedian) {
      final t = (price - priceP25) / (priceMedian - priceP25).clamp(1, double.infinity);
      return 90 - (t * 25); // 90% -> 65%
    }
    if (price <= priceP75) {
      final t = (price - priceMedian) / (priceP75 - priceMedian).clamp(1, double.infinity);
      return 65 - (t * 45); // 65% -> 20%
    }
    return 20 - ((price - priceP75) / (priceHigh - priceP75).clamp(1, double.infinity) * 15).clamp(0, 15);
  }

  /// Market position label
  String positionLabel(double price) {
    final pct = percentileFor(price);
    if (pct < 25) return 'Underpriced';
    if (pct < 40) return 'Below Market';
    if (pct < 60) return 'Market Rate';
    if (pct < 75) return 'Above Market';
    return 'Premium';
  }

  factory MarketBenchmark.fromJson(Map<String, dynamic> json) {
    return MarketBenchmark(
      id: json['id'] as String,
      serviceCategory: json['service_category'] as String,
      serviceType: json['service_type'] as String?,
      regionCode: json['region_code'] as String? ?? 'default',
      period: json['period'] as String? ?? 'monthly',
      periodStart: DateTime.parse(json['period_start'] as String),
      periodEnd: DateTime.parse(json['period_end'] as String),
      sampleSize: json['sample_size'] as int? ?? 0,
      priceLow: _d(json['price_low']),
      priceP25: _d(json['price_p25']),
      priceMedian: _d(json['price_median']),
      priceP75: _d(json['price_p75']),
      priceHigh: _d(json['price_high']),
      priceAvg: _d(json['price_avg']),
      priceStddev: _d(json['price_stddev']),
      winRateLow: _d(json['win_rate_low']),
      winRateMedian: _d(json['win_rate_median']),
      winRateHigh: _d(json['win_rate_high']),
      updatedAt: DateTime.tryParse(json['updated_at'] as String? ?? '') ?? DateTime.now(),
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
