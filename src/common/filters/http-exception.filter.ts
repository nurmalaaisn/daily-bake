import {
    ExceptionFilter,
    Catch,
    ArgumentsHost,
    HttpException,
    HttpStatus,
    Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
    private readonly logger = new Logger(HttpExceptionFilter.name);

    catch(exception: HttpException, host: ArgumentsHost) {
        const ctx = host.switchToHttp();
        const response = ctx.getResponse<Response>();
        const request = ctx.getRequest<Request>();
        const status = exception.getStatus();
        const exceptionResponse = exception.getResponse();

        const message =
            typeof exceptionResponse === 'object' &&
                'message' in exceptionResponse
                ? (exceptionResponse as any).message
                : exception.message;

        const errorResponse = {
            statusCode: status,
            message: Array.isArray(message) ? message[0] : message,
            errors: Array.isArray(message) ? message : undefined,
            path: request.url,
            method: request.method,
            timestamp: new Date().toISOString(),
        };

        if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
            this.logger.error(
                `${request.method} ${request.url} → ${status}`,
                exception.stack,
            );
        }

        response.status(status).json(errorResponse);
    }
}