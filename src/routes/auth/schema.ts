import * as v from 'valibot';
import { describeRoute, resolver } from 'hono-openapi';


export const LoginSchema = v.object({
    email: v.pipe(
        v.string('Email is required'),
        v.email('Invalid email format')
    ),
    password: v.string('Password is required')
});

export const RegisterSchema = v.object({
    email: v.pipe(v.string(), v.email(), v.maxLength(255, 'Email cannot exceed 255 characters')),
    username: v.pipe(v.string(), v.minLength(3, 'Username must be at least 3 characters'), v.maxLength(30, 'Username cannot exceed 30 characters')),
    password: v.pipe(v.string('Password is required'),
        v.minLength(8, 'Password must be at least 8 characters'),
        v.maxLength(255, 'Password is too long')
    ),
});

export const SocialLoginSchema = v.object({
    provider: v.union([v.literal('google'), v.literal('github')]),
    idToken: v.string('ID token is required'),
    referralCode: v.optional(v.string()),
})

export const RefreshTokenSchema = v.object({
    refreshToken: v.pipe(v.string('Refresh token is required'),
        v.minLength(1, 'Refresh token cannot be empty')
    ),
});

const TokenResponse = v.object({
    accessToken: v.string(),
    refreshToken: v.string(),
});

const ErrorResponse = v.object({
    error: v.string(),
});

const MessageResponse = v.object({
    message: v.string(),
});


export const loginDocs = describeRoute({
    tags: ['Auth'],
    summary: 'Login with email and password',
    description: 'Authenticates a user and returns access + refresh tokens.',
    responses: {
        200: {
            description: 'Successful login',
            content: { 'application/json': { schema: resolver(TokenResponse) } },
        },
        401: {
            description: 'Invalid credentials',
            content: { 'application/json': { schema: resolver(ErrorResponse) } },
        },
    },
});

export const registerDocs = describeRoute({
    tags: ['Auth'],
    summary: 'Register a new user',
    description: 'Creates a new user account with profile, preferences, and notification settings.',
    responses: {
        201: {
            description: 'User registered successfully',
            content: { 'application/json': { schema: resolver(MessageResponse) } },
        },
        409: {
            description: 'User already exists',
            content: { 'application/json': { schema: resolver(ErrorResponse) } },
        },
    },
});

export const socialLoginDocs = describeRoute({
    tags: ['Auth'],
    summary: 'Social login (Google)',
    description: 'Authenticates via a social provider ID token. Creates an account on first login.',
    responses: {
        200: {
            description: 'Successful authentication',
            content: { 'application/json': { schema: resolver(TokenResponse) } },
        },
        401: {
            description: 'Invalid or expired social token',
            content: { 'application/json': { schema: resolver(ErrorResponse) } },
        },
        501: {
            description: 'Provider not implemented',
            content: { 'application/json': { schema: resolver(ErrorResponse) } },
        },
    },
});

export const refreshDocs = describeRoute({
    tags: ['Auth'],
    summary: 'Refresh access token',
    description: 'Rotates the refresh token and returns a new access + refresh token pair.',
    responses: {
        200: {
            description: 'Tokens refreshed',
            content: { 'application/json': { schema: resolver(TokenResponse) } },
        },
        401: {
            description: 'Invalid or expired token',
            content: { 'application/json': { schema: resolver(ErrorResponse) } },
        },
        403: {
            description: 'Token reuse detected — session terminated',
            content: { 'application/json': { schema: resolver(ErrorResponse) } },
        },
    },
});

export const logoutDocs = describeRoute({
    tags: ['Auth'],
    summary: 'Logout',
    description: 'Invalidates the entire token family associated with the refresh token.',
    responses: {
        200: {
            description: 'Logged out successfully',
            content: { 'application/json': { schema: resolver(MessageResponse) } },
        },
    },
});