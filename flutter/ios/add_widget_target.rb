#!/usr/bin/env ruby
# Adds the iWorkrWidget extension target to the Xcode project.
# Uses the xcodeproj gem (ships with CocoaPods/Fastlane).

require 'xcodeproj'

project_path = File.join(__dir__, 'Runner.xcodeproj')
project = Xcodeproj::Project.open(project_path)

# ── Check if target already exists ────────────────────────
if project.targets.any? { |t| t.name == 'iWorkrWidgetExtension' }
  puts "✓ iWorkrWidgetExtension target already exists, skipping."
  exit 0
end

runner_target = project.targets.find { |t| t.name == 'Runner' }

# ── Create the widget extension target ────────────────────
widget_target = project.new_target(
  :app_extension,
  'iWorkrWidgetExtension',
  :ios,
  '16.1'
)

widget_target.product_name = 'iWorkrWidgetExtension'

# ── Add source files ──────────────────────────────────────
widget_dir = File.join(__dir__, 'iWorkrWidget')

widget_group = project.main_group.new_group('iWorkrWidget', 'iWorkrWidget')

swift_files = Dir.glob(File.join(widget_dir, '*.swift'))
swift_files.each do |file|
  filename = File.basename(file)
  ref = widget_group.new_reference(filename)
  widget_target.source_build_phase.add_file_reference(ref)
end

# ── Add Info.plist ────────────────────────────────────────
info_plist_path = File.join(widget_dir, 'Info.plist')
if File.exist?(info_plist_path)
  widget_group.new_reference('Info.plist')
end

# ── Add entitlements ──────────────────────────────────────
entitlements_path = File.join(widget_dir, 'iWorkrWidget.entitlements')
if File.exist?(entitlements_path)
  widget_group.new_reference('iWorkrWidget.entitlements')
end

# ── Configure build settings ──────────────────────────────
widget_target.build_configurations.each do |config|
  settings = config.build_settings
  settings['PRODUCT_BUNDLE_IDENTIFIER'] = 'com.iworkr.app.iWorkrWidget'
  settings['INFOPLIST_FILE'] = 'iWorkrWidget/Info.plist'
  settings['CODE_SIGN_ENTITLEMENTS'] = 'iWorkrWidget/iWorkrWidget.entitlements'
  settings['SWIFT_VERSION'] = '5.0'
  settings['TARGETED_DEVICE_FAMILY'] = '1,2'
  settings['IPHONEOS_DEPLOYMENT_TARGET'] = '16.1'
  settings['GENERATE_INFOPLIST_FILE'] = 'NO'
  settings['CURRENT_PROJECT_VERSION'] = '1'
  settings['MARKETING_VERSION'] = '1.0.0'
  settings['ASSETCATALOG_COMPILER_WIDGET_BACKGROUND_COLOR_NAME'] = 'WidgetBackground'
  settings['ASSETCATALOG_COMPILER_GLOBAL_ACCENT_COLOR_NAME'] = 'AccentColor'
  settings['SKIP_INSTALL'] = 'YES'
  settings['LD_RUNPATH_SEARCH_PATHS'] = [
    '$(inherited)',
    '@executable_path/Frameworks',
    '@executable_path/../../Frameworks'
  ]
  settings['CODE_SIGN_STYLE'] = 'Automatic'
  settings['DEVELOPMENT_TEAM'] = '$(DEVELOPMENT_TEAM)'

  if config.name == 'Debug'
    settings['SWIFT_OPTIMIZATION_LEVEL'] = '-Onone'
  else
    settings['SWIFT_OPTIMIZATION_LEVEL'] = '-O'
  end
end

# ── Add WidgetKit + SwiftUI frameworks ────────────────────
['WidgetKit', 'SwiftUI', 'ActivityKit'].each do |fw_name|
  framework_ref = project.frameworks_group.new_reference("#{fw_name}.framework")
  framework_ref.source_tree = 'SDKROOT'
  framework_ref.path = "System/Library/Frameworks/#{fw_name}.framework"
  build_file = widget_target.frameworks_build_phase.add_file_reference(framework_ref, true)
  build_file.settings = { 'ATTRIBUTES' => ['Weak'] } if fw_name == 'ActivityKit'
end

# ── Embed the extension in Runner ─────────────────────────
embed_phase = runner_target.new_copy_files_build_phase('Embed Foundation Extensions')
embed_phase.dst_subfolder_spec = '13' # PlugIns folder
embed_phase.add_file_reference(widget_target.product_reference, true)
embed_phase.files.last.settings = { 'ATTRIBUTES' => ['RemoveHeadersOnCopy'] }

# ── Add target dependency ─────────────────────────────────
runner_target.add_dependency(widget_target)

# ── Save ──────────────────────────────────────────────────
project.save
puts "✓ iWorkrWidgetExtension target added to Runner.xcodeproj"
puts "  - 2 Swift source files"
puts "  - Info.plist + entitlements"
puts "  - WidgetKit, SwiftUI, ActivityKit frameworks"
puts "  - Embedded in Runner via 'Embed Foundation Extensions'"
puts "  - Target dependency Runner → iWorkrWidgetExtension"
