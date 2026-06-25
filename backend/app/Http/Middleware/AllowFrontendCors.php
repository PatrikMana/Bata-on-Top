<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class AllowFrontendCors
{
    public function handle(Request $request, Closure $next): Response
    {
        $allowedOrigin = rtrim((string) config('api.frontend_origin'), '/');
        $requestOrigin = $request->headers->get('Origin');
        $originIsAllowed = $requestOrigin !== null
            && $allowedOrigin !== ''
            && hash_equals($allowedOrigin, rtrim($requestOrigin, '/'));

        if (! $originIsAllowed && ($requestOrigin !== null || config('api.require_origin'))) {
            return response()->json([
                'message' => 'Origin is not allowed.',
            ], 403);
        }

        if ($request->isMethod('OPTIONS')) {
            return $this->addCorsHeaders(response()->noContent(), $requestOrigin);
        }

        return $this->addCorsHeaders($next($request), $requestOrigin);
    }

    private function addCorsHeaders(Response $response, ?string $requestOrigin): Response
    {
        if ($requestOrigin === null) {
            return $response;
        }

        $response->headers->set('Access-Control-Allow-Origin', $requestOrigin);
        $response->headers->set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        $response->headers->set('Access-Control-Allow-Headers', 'Content-Type, Accept');
        $response->headers->set('Access-Control-Max-Age', '86400');
        $response->headers->set('Vary', 'Origin');

        return $response;
    }
}
