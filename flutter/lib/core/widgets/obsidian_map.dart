import 'dart:async';

import 'package:flutter/material.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart';

import 'package:iworkr_mobile/core/theme/obsidian_theme.dart';

const _darkMapStyle = '''
[
  {"elementType":"geometry","stylers":[{"color":"#0a0a0a"}]},
  {"elementType":"labels.text.fill","stylers":[{"color":"#52525b"}]},
  {"elementType":"labels.text.stroke","stylers":[{"color":"#0a0a0a"}]},
  {"featureType":"administrative","elementType":"geometry.stroke","stylers":[{"color":"#27272a"}]},
  {"featureType":"administrative.land_parcel","stylers":[{"visibility":"off"}]},
  {"featureType":"administrative.neighborhood","stylers":[{"visibility":"off"}]},
  {"featureType":"landscape","elementType":"geometry","stylers":[{"color":"#0a0a0a"}]},
  {"featureType":"poi","stylers":[{"visibility":"off"}]},
  {"featureType":"road","elementType":"geometry","stylers":[{"color":"#18181b"}]},
  {"featureType":"road","elementType":"geometry.stroke","stylers":[{"color":"#27272a"}]},
  {"featureType":"road","elementType":"labels","stylers":[{"visibility":"off"}]},
  {"featureType":"road.highway","elementType":"geometry","stylers":[{"color":"#1c1c1e"}]},
  {"featureType":"road.highway","elementType":"geometry.stroke","stylers":[{"color":"#27272a"}]},
  {"featureType":"transit","stylers":[{"visibility":"off"}]},
  {"featureType":"water","elementType":"geometry","stylers":[{"color":"#050505"}]},
  {"featureType":"water","elementType":"labels","stylers":[{"visibility":"off"}]}
]
''';

const _lightMapStyle = '''
[
  {"elementType":"geometry","stylers":[{"color":"#f4f4f5"}]},
  {"elementType":"labels.text.fill","stylers":[{"color":"#71717a"}]},
  {"elementType":"labels.text.stroke","stylers":[{"color":"#fafafa"}]},
  {"featureType":"administrative","elementType":"geometry.stroke","stylers":[{"color":"#e4e4e7"}]},
  {"featureType":"administrative.land_parcel","stylers":[{"visibility":"off"}]},
  {"featureType":"administrative.neighborhood","stylers":[{"visibility":"off"}]},
  {"featureType":"landscape","elementType":"geometry","stylers":[{"color":"#f4f4f5"}]},
  {"featureType":"poi","stylers":[{"visibility":"off"}]},
  {"featureType":"road","elementType":"geometry","stylers":[{"color":"#ffffff"}]},
  {"featureType":"road","elementType":"geometry.stroke","stylers":[{"color":"#e4e4e7"}]},
  {"featureType":"road","elementType":"labels","stylers":[{"visibility":"off"}]},
  {"featureType":"road.highway","elementType":"geometry","stylers":[{"color":"#ffffff"}]},
  {"featureType":"road.highway","elementType":"geometry.stroke","stylers":[{"color":"#d4d4d8"}]},
  {"featureType":"transit","stylers":[{"visibility":"off"}]},
  {"featureType":"water","elementType":"geometry","stylers":[{"color":"#e4e4e7"}]},
  {"featureType":"water","elementType":"labels","stylers":[{"visibility":"off"}]}
]
''';

class ObsidianMap extends StatefulWidget {
  final LatLng center;
  final double zoom;
  final Set<Marker> markers;
  final Set<Polyline> polylines;
  final bool interactive;
  final EdgeInsets padding;
  final void Function(GoogleMapController)? onMapCreated;

  const ObsidianMap({
    super.key,
    required this.center,
    this.zoom = 13,
    this.markers = const {},
    this.polylines = const {},
    this.interactive = true,
    this.padding = EdgeInsets.zero,
    this.onMapCreated,
  });

  @override
  State<ObsidianMap> createState() => _ObsidianMapState();
}

class _ObsidianMapState extends State<ObsidianMap> {
  final Completer<GoogleMapController> _controller = Completer();

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return GoogleMap(
      initialCameraPosition: CameraPosition(
        target: widget.center,
        zoom: widget.zoom,
      ),
      markers: widget.markers,
      polylines: widget.polylines,
      padding: widget.padding,
      myLocationEnabled: false,
      myLocationButtonEnabled: false,
      zoomControlsEnabled: false,
      mapToolbarEnabled: false,
      compassEnabled: false,
      liteModeEnabled: false,
      rotateGesturesEnabled: widget.interactive,
      scrollGesturesEnabled: widget.interactive,
      zoomGesturesEnabled: widget.interactive,
      tiltGesturesEnabled: false,
      style: isDark ? _darkMapStyle : _lightMapStyle,
      onMapCreated: (controller) {
        _controller.complete(controller);
        widget.onMapCreated?.call(controller);
      },
    );
  }

  @override
  void dispose() {
    _controller.future.then((c) => c.dispose());
    super.dispose();
  }
}

/// Simple inline map showing a single pin at [lat],[lng].
class ObsidianInlineMap extends StatelessWidget {
  final double lat;
  final double lng;
  final double zoom;
  final double height;

  const ObsidianInlineMap({
    super.key,
    required this.lat,
    required this.lng,
    this.zoom = 15,
    this.height = 160,
  });

  @override
  Widget build(BuildContext context) {
    final pos = LatLng(lat, lng);
    return SizedBox(
      height: height,
      child: ClipRRect(
        borderRadius: ObsidianTheme.radiusMd,
        child: ObsidianMap(
          center: pos,
          zoom: zoom,
          interactive: false,
          markers: {
            Marker(
              markerId: const MarkerId('pin'),
              position: pos,
              icon: BitmapDescriptor.defaultMarkerWithHue(BitmapDescriptor.hueGreen),
            ),
          },
        ),
      ),
    );
  }
}
