# Custom action to create bundle ID + app via App Store Connect API (no Apple ID password needed)
module Fastlane
  module Actions
    class CreateAppApiAction < Action
      def self.run(params)
        key_id = params[:key_id] || ENV["ASC_KEY_ID"]
        issuer_id = params[:issuer_id] || ENV["ASC_ISSUER_ID"]
        key_content_b64 = params[:key_content] || ENV["ASC_KEY_CONTENT"]
        app_name = params[:app_name] || "iWorkr"
        bundle_id = params[:bundle_id] || "com.iworkr.app"
        sku = params[:sku] || "com.iworkr.app.ios"

        require "base64"
        require "jwt"
        require "net/http"
        require "json"

        key_pem = Base64.strict_decode64(key_content_b64.to_s)
        private_key = OpenSSL::PKey.read(key_pem)

        token = JWT.encode(
          {
            iss: issuer_id,
            exp: Time.now.to_i + 20 * 60,
            iat: Time.now.to_i,
            aud: "appstoreconnect-v1"
          },
          private_key,
          "ES256",
          { kid: key_id }.compact
        )

        api_post = lambda do |tok, path, body_hash|
          uri = URI("https://api.appstoreconnect.apple.com/v1#{path}")
          http = Net::HTTP.new(uri.host, uri.port)
          http.use_ssl = true
          req = Net::HTTP::Post.new(uri)
          req["Authorization"] = "Bearer #{tok}"
          req["Content-Type"] = "application/json"
          req.body = body_hash.to_json
          http.request(req)
        end

        # 1. Create bundle ID if it doesn't exist
        UI.message("Registering bundle ID: #{bundle_id}")
        bundle_res = api_post.call(token, "/bundleIds", {
          data: {
            type: "bundleIds",
            attributes: {
              identifier: bundle_id,
              name: app_name,
              platform: "IOS"
            }
          }
        })

        if bundle_res.code.to_i == 409
          UI.important("Bundle ID already exists, continuing...")
        elsif !bundle_res.code.to_i.between?(200, 299)
          UI.user_error!("Bundle ID creation failed (#{bundle_res.code}): #{bundle_res.body}")
        else
          UI.success("Bundle ID registered")
        end

        # 2. Create app
        UI.message("Creating app on App Store Connect...")
        app_res = api_post.call(token, "/apps", {
          data: {
            type: "apps",
            attributes: {
              name: app_name,
              bundleId: bundle_id,
              sku: sku,
              primaryLocale: "en-US"
            }
          }
        })

        if app_res.code.to_i.between?(200, 299)
          UI.success("App created successfully on App Store Connect!")
          return JSON.parse(app_res.body)
        else
          error_body = app_res.body rescue ""
          UI.user_error!("App creation failed (#{app_res.code}): #{error_body}")
        end
      end

      def self.description
        "Create an app on App Store Connect via API (no Apple ID password)"
      end

      def self.available_options
        [
          FastlaneCore::ConfigItem.new(key: :key_id, env_name: "ASC_KEY_ID", optional: true),
          FastlaneCore::ConfigItem.new(key: :issuer_id, env_name: "ASC_ISSUER_ID", optional: true),
          FastlaneCore::ConfigItem.new(key: :key_content, env_name: "ASC_KEY_CONTENT", optional: true, sensitive: true),
          FastlaneCore::ConfigItem.new(key: :app_name, default_value: "iWorkr"),
          FastlaneCore::ConfigItem.new(key: :bundle_id, default_value: "com.iworkr.app"),
          FastlaneCore::ConfigItem.new(key: :sku, default_value: "com.iworkr.app.ios")
        ]
      end

      def self.is_supported?(platform)
        [:ios, :mac].include?(platform)
      end
    end
  end
end
