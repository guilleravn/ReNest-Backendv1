import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';

import {
  CurrentUser,
  type CurrentUserPayload,
} from '../common/decorators/current-user.decorator.js';
import { Public } from '../common/decorators/public.decorator.js';
import { AuthService } from './auth.service.js';
import { CREDENTIALS_THROTTLE } from './credentials-throttle.js';
import { AccessTokenResponseDto } from './dto/access-token-response.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { RegisterDto } from './dto/register.dto.js';
import { UserProfileResponseDto } from './dto/user-profile-response.dto.js';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Throttle(CREDENTIALS_THROTTLE)
  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() dto: LoginDto): Promise<AccessTokenResponseDto> {
    return this.authService.login(dto);
  }

  @Public()
  @Throttle(CREDENTIALS_THROTTLE)
  @Post('register')
  register(@Body() dto: RegisterDto): Promise<AccessTokenResponseDto> {
    return this.authService.register(dto);
  }

  @Get('me')
  me(@CurrentUser() user: CurrentUserPayload): Promise<UserProfileResponseDto> {
    return this.authService.me(user.id);
  }
}
