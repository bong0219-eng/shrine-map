export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    const allowedOrigins = [
      "https://bong0219.github.io"
    ];

    const origin = request.headers.get("Origin") || "";
    const allowOrigin = allowedOrigins.includes(origin) ? origin : allowedOrigins[0];

    const corsHeaders = {
      "Access-Control-Allow-Origin": allowOrigin,
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    if (request.method !== "GET") {
      return new Response("Method Not Allowed", {
        status: 405,
        headers: corsHeaders
      });
    }

    if (origin && !allowedOrigins.includes(origin)) {
      return new Response("Forbidden", {
        status: 403,
        headers: corsHeaders
      });
    }

    const target = url.searchParams.get("target");
    let kakaoUrl = "";

    if (target === "keyword") {
      kakaoUrl = "https://dapi.kakao.com/v2/local/search/keyword.json";
    } else if (target === "coord2address") {
      kakaoUrl = "https://dapi.kakao.com/v2/local/geo/coord2address.json";
    } else if (target === "coord2regioncode") {
      kakaoUrl = "https://dapi.kakao.com/v2/local/geo/coord2regioncode.json";
    } else if (target === "directions") {
      kakaoUrl = "https://apis-navi.kakaomobility.com/v1/directions";
    } else {
      return new Response("Invalid target", {
        status: 400,
        headers: corsHeaders
      });
    }

    const kakao = new URL(kakaoUrl);

    for (const [key, value] of url.searchParams.entries()) {
      if (key !== "target") {
        kakao.searchParams.set(key, value);
      }
    }

    const response = await fetch(kakao.toString(), {
      headers: {
        "Authorization": "KakaoAK " + env.KAKAO_REST_KEY
      }
    });

    const body = await response.text();

    return new Response(body, {
      status: response.status,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json; charset=utf-8"
      }
    });
  }
};
