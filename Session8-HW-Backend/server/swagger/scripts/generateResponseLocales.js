'use strict';

/**
 * Generates locales/responsePhrases.en.js and locales/opDescriptions.en.js
 * Run: node server/swagger/scripts/generateResponseLocales.js
 */

const fs = require('fs');
const path = require('path');
const spec = require('../swaggerConfig');

const OUT_RESPONSES = path.join(__dirname, '../locales/responsePhrases.en.js');
const OUT_OPS = path.join(__dirname, '../locales/opDescriptions.en.js');

const RESPONSE_PHRASES = {
  'admin ایجاد شد': 'Admin created',
  'admin: { id, username, email, role, last_login }': 'admin: { id, username, email, role, last_login }',
  'admins[]': 'admins[]',
  'asset با toman_value': 'asset with toman_value',
  'asset به‌روز': 'asset updated',
  'assets, total_value, by_risk, by_category': 'assets, total_value, by_risk, by_category',
  'banner به‌روز شد': 'Banner updated',
  'banners[] + status + ctr': 'banners[] + status + ctr',
  'banners[] — ممکن است خالی باشد': 'banners[] — may be empty',
  'categories': 'categories',
  'categories[] با transaction_count, total_amount, percentage': 'categories[] with transaction_count, total_amount, percentage',
  'comparison + trends': 'comparison + trends',
  'contributions با amount مثبت (واریز) یا منفی (برداشت)': 'contributions with positive amount (deposit) or negative (withdrawal)',
  'count': 'count',
  'days + peak_day_insight': 'days + peak_day_insight',
  'endpoint الزامی است': 'Endpoint is required',
  'expense + shares': 'expense + shares',
  'favorites[]': 'favorites[]',
  'gold_currency, crypto, commodity, errors': 'gold_currency, crypto, commodity, errors',
  'group + members + expenses + settlements + summary': 'group + members + expenses + settlements + summary',
  'group + personal (nullable) + cta': 'group + personal (nullable) + cta',
  'group + share_url': 'group + share_url',
  'groups[] با member_count, total_expenses, my_balance': 'groups[] with member_count, total_expenses, my_balance',
  'history[] + best_month + avg_score + trend (up|down|stable)': 'history[] + best_month + avg_score + trend (up|down|stable)',
  'income/expense/balance/daily_totals': 'income/expense/balance/daily_totals',
  'insights[] (peak_day, category_trend, savings_rate, subscriptions, budget_adherence, logging_streak) + generated_at':
    'insights[] (peak_day, category_trend, savings_rate, subscriptions, budget_adherence, logging_streak) + generated_at',
  'items + cached + cache_age_minutes + group': 'items + cached + cache_age_minutes + group',
  'logs[], total, page, limit — admin_username نه ID': 'logs[], total, page, limit — admin_username not ID',
  'member': 'member',
  'messages[] شامل read_rate و sent_by': 'messages[] including read_rate and sent_by',
  'monthly_snapshots': 'monthly_snapshots',
  'months[] با new_users, new_subscriptions, total_transactions': 'months[] with new_users, new_subscriptions, total_transactions',
  'months[], total_revenue_6m, avg_monthly_revenue': 'months[], total_revenue_6m, avg_monthly_revenue',
  'price_usd, price_toman, market_cap': 'price_usd, price_toman, market_cap',
  'projected_end_balance + confidence': 'projected_end_balance + confidence',
  'recommendation': 'recommendation',
  'recommendation + stats (pending/done/dismissed %) + users_done[]':
    'recommendation + stats (pending/done/dismissed %) + users_done[]',
  'recommendations + counts': 'recommendations + counts',
  'recommendations + total + stats per row': 'recommendations + total + stats per row',
  'registered + display_name یا registered:false': 'registered + display_name or registered:false',
  'requests[] + pagination': 'requests[] + pagination',
  'score 0-100 + breakdown + tips + label + color': 'score 0-100 + breakdown + tips + label + color',
  'section: precious|base|energy': 'section: precious|base|energy',
  'seed نامعتبر': 'Invalid seed',
  'session ادمین': 'Admin session',
  'session ادمین لازم است': 'Admin session required',
  'settlement + transaction_id': 'settlement + transaction_id',
  'snapshots, change_7d, change_30d': 'snapshots, change_7d, change_30d',
  'stats + done_users': 'stats + done_users',
  'subscriptions + total_monthly': 'subscriptions + total_monthly',
  'success': 'Success',
  'success + sent_count + recommendation_title': 'success + sent_count + recommendation_title',
  'success + status': 'success + status',
  'success + updated_count': 'success + updated_count',
  'success: true': 'success: true',
  'total_assets, net_worth, trend': 'total_assets, net_worth, trend',
  'total_banners, active_now, overall_ctr, top_banner': 'total_banners, active_now, overall_ctr, top_banner',
  'total_income, total_budgeted, unassigned, is_zero_based': 'total_income, total_budgeted, unassigned, is_zero_based',
  'total_sent_today, total_sent_this_month, avg_read_rate, broadcast_count, direct_count':
    'total_sent_today, total_sent_this_month, avg_read_rate, broadcast_count, direct_count',
  'types[]': 'types[]',
  'user, stats, verification_requests, subscription_requests, referrals, devices':
    'user, stats, verification_requests, subscription_requests, referrals, devices',
  'users, verification, subscriptions, transactions, banners, goals':
    'users, verification, subscriptions, transactions, banners, goals',
  'users[]': 'users[]',
  'users[] + pagination': 'users[] + pagination',
  'آمار کلی': 'Overview statistics',
  'آواتار ویژه — اشتراک فعال ندارید': 'Premium avatar — no active subscription',
  'آپلود موفق': 'Upload successful',
  'ادمین': 'Admin',
  'ارسال موفق': 'Sent successfully',
  'ارسال موفق کد': 'Code sent successfully',
  'ارسال موفق کد بازیابی': 'Recovery code sent successfully',
  'اشتراک': 'Subscription',
  'اشتراک فعال لازم': 'Active subscription required',
  'اضافه شد': 'Added',
  'اطلاعات تکراری': 'Duplicate information',
  'اطلاعات پروفایل': 'Profile information',
  'اعتبارسنجی': 'Validation',
  'اعتبارسنجی عنوان/متن': 'Title/body validation',
  'انجام شد': 'Done',
  'ایجاد شد': 'Created',
  'ایمیل تایید نشده است': 'Email not verified',
  'ایمیل نامعتبر': 'Invalid email',
  'این درخواست قبلاً بررسی شده است': 'This request has already been reviewed',
  'این نام کاربری قبلاً ثبت شده است': 'This username is already taken',
  'بدهی تسویه‌نشده': 'Unsettled debt',
  'بدون اشتراک فعال': 'No active subscription',
  'برداشت ثبت شد': 'Withdrawal recorded',
  'بروزرسانی موفق': 'Updated successfully',
  'بنر با موفقیت آپلود شد': 'Banner uploaded successfully',
  'بنر یافت نشد': 'Banner not found',
  'به‌روز شد': 'Updated',
  'به‌روزرسانی شد': 'Updated',
  'بودجه ذخیره شد': 'Budget saved',
  'بودجه‌ای برای ماه قبل یافت نشد': 'No budget found for the previous month',
  'بودجه‌ها ذخیره شدند': 'Budgets saved',
  'تاریخ نامعتبر': 'Invalid date',
  'تاریخ یا فرمت نامعتبر': 'Invalid date or format',
  'تایید OTP انجام نشده است': 'OTP verification not completed',
  'تایید موفق': 'Approved successfully',
  'تداخل با داده‌های موجود (مثلاً کد ملی تکراری)': 'Conflict with existing data (e.g. duplicate national ID)',
  'تراکنش ثبت شد': 'Transaction recorded',
  'تراکنش یافت نشد': 'Transaction not found',
  'تغییر موفق': 'Changed successfully',
  'تغییر موفق رمز عبور': 'Password changed successfully',
  'تلاش برای ویرایش فیلدی که به‌دلیل احراز هویت قفل شده است':
    'Attempt to edit a field locked due to verification level',
  'ثبت شد': 'Recorded',
  'ثبت موفق': 'Recorded successfully',
  'ثبت‌نام موفق': 'Registration successful',
  'جزئیات تراکنش': 'Transaction details',
  'حجم فایل بیش از ۲ مگابایت': 'File size exceeds 2 MB',
  'حجم فایل بیش از ۳ مگابایت است': 'File size exceeds 3 MB',
  'حذف انجام شد': 'Deletion completed',
  'حذف شد': 'Deleted',
  'حذف موفق': 'Deleted successfully',
  'حساب کاربری با این ایمیل پیدا نشد (فقط برای reset_password)':
    'No account found with this email (reset_password only)',
  'حساب کاربری غیرفعال است': 'Account is deactivated',
  'حساب کاربری قفل شده است': 'Account is locked',
  'حساب کاربری یافت نشد': 'Account not found',
  'حسابی با این شماره موبایل ثبت نشده است': 'No account registered with this mobile number',
  'خروج موفق': 'Logout successful',
  'خطا': 'Error',
  'خطای ارسال ایمیل': 'Email send error',
  'خطای اعتبارسنجی فایل یا ترتیب نمایش': 'File validation or display order error',
  'خطای اعتبارسنجی فیلدها': 'Field validation error',
  'خطای اعتبارسنجی ورودی‌ها': 'Input validation error',
  'خطای سرور': 'Server error',
  'خطای سرور در آپلود فایل': 'Server error during file upload',
  'خطای فایل': 'File error',
  'خطای ولیدیشن': 'Validation error',
  'خطای ولیدیشن طول فیلد': 'Field length validation error',
  'خلاصه': 'Summary',
  'داده‌های دعوت کاربر': 'User referral data',
  'داده‌ی نامعتبر': 'Invalid data',
  'درخواست اشتراک در حال بررسی وجود دارد': 'A subscription request is already pending',
  'درخواست تکراری در صف': 'Duplicate request in queue',
  'درخواست ثبت شد': 'Request submitted',
  'درخواست قبلاً بررسی شده است': 'Request already reviewed',
  'درخواست قبلاً بررسی شده یا با سطح فعلی کاربر همخوانی ندارد':
    'Request already reviewed or incompatible with the user\'s current level',
  'درخواست یا کاربر یافت نشد': 'Request or user not found',
  'درخواست یافت نشد': 'Request not found',
  'دسترسی ادمین وجود ندارد': 'Admin access denied',
  'دسترسی غیرمجاز': 'Unauthorized',
  'دسترسی غیرمجاز (نقش ادمین لازم است)': 'Unauthorized (admin role required)',
  'دسترسی غیرمجاز — لطفاً وارد پنل ادمین شوید': 'Unauthorized — please log in to the admin panel',
  'دسته نامعتبر': 'Invalid category',
  'دستگاه یافت نشد یا متعلق به کاربر دیگری است': 'Device not found or belongs to another user',
  'رد موفق': 'Rejected successfully',
  'رمز عبور اشتباه است (شماره موبایل وجود دارد)': 'Incorrect password (mobile number exists)',
  'رمز عبور با قوانین پیچیدگی مطابقت ندارد': 'Password does not meet complexity rules',
  'رمز عبور با موفقیت تغییر یافت': 'Password changed successfully',
  'رمز عبور فعلی اشتباه است': 'Current password is incorrect',
  'رمز عبور فعلی اشتباه است (یا کاربر وارد سیستم نشده)': 'Current password incorrect (or user not logged in)',
  'رمز عبور و تکرار آن یکسان نیستند': 'Password and confirmation do not match',
  'ریست موفق': 'Reset successful',
  'سرویس در دسترس نیست': 'Service unavailable',
  'سرویس پوش غیرفعال است': 'Push service is disabled',
  'سطح درخواستی معتبر نیست یا برابر current_level + 1 نیست':
    'Requested level is invalid or not equal to current_level + 1',
  'شناسه دستگاه معتبر نیست': 'Invalid device ID',
  'شناسه نامعتبر': 'Invalid ID',
  'شناسه نامعتبر یا پلن نامعتبر': 'Invalid ID or invalid plan',
  'شناسه پیام معتبر نیست': 'Invalid message ID',
  'عضو نیستید': 'You are not a member',
  'علامت‌گذاری موفق': 'Marked successfully',
  'عکس شخصی تنظیم نشده است': 'No custom photo configured',
  'فایل CSV': 'CSV file',
  'فایل CSV با تاریخ شمسی': 'CSV file with Jalali dates',
  'فایل PDF': 'PDF file',
  'فایل نامعتبر یا خالی': 'Invalid or empty file',
  'فرمت ایمیل نامعتبر': 'Invalid email format',
  'فرمت ورودی نامعتبر': 'Invalid input format',
  'فرمت کد دعوت صحیح نیست': 'Invalid invite code format',
  'فیلدها تکمیل نشده‌اند یا رمز جدید با فعلی یکسان است / تکرار رمز اشتباه':
    'Required fields missing, new password matches current, or password confirmation incorrect',
  'فیلدهای موردنیاز این سطح در پروفایل تکمیل نشده‌اند':
    'Required profile fields for this level are incomplete',
  'قبلاً پاسخ داده شده': 'Already responded',
  'قیمت الزامی': 'Price is required',
  'لازم است وارد شوید': 'Login required',
  'لطفاً وارد حساب کاربری خود شوید': 'Please log in to your account',
  'لیست آواتارها': 'Avatar list',
  'لیست استوری‌ها': 'Story list',
  'لیست اهداف با percentage، remaining، monthly_needed': 'Goals list with percentage, remaining, monthly_needed',
  'لیست بودجه‌ها با spent/remaining/status': 'Budgets list with spent/remaining/status',
  'لیست تراکنش‌ها': 'Transaction list',
  'لیست تراکنش‌های تکراری': 'Recurring transactions list',
  'لیست تگ‌ها': 'Tags list',
  'لیست خالی': 'Empty list',
  'لیست درخواست‌ها': 'Request list',
  'لیست دسته‌بندی‌ها': 'Category list',
  'لیست دستگاه‌ها': 'Device list',
  'لیست روابط دعوت': 'Referral relationships list',
  'لیست پیام‌ها': 'Message list',
  'لینک نامعتبر': 'Invalid link',
  'مبلغ نامعتبر': 'Invalid amount',
  'مبلغ یا دسته نامعتبر': 'Invalid amount or category',
  'مجموع سهم‌ها نامعتبر': 'Invalid share totals',
  'مقادیر نامعتبر': 'Invalid values',
  'موبایل تکراری': 'Duplicate mobile number',
  'موجودی ناکافی': 'Insufficient balance',
  'موفق': 'Success',
  'نام بیش از ۶۰ کاراکتر': 'Name exceeds 60 characters',
  'نام کاربری یا رمز عبور اشتباه است': 'Incorrect username or password',
  'نتیجه بررسی تکراری بودن': 'Duplicate check result',
  'نمی‌توانید حساب خود را حذف کنید / حداقل یک سوپر ادمین باید وجود داشته باشد':
    'Cannot delete your own account / at least one superadmin must remain',
  'نمی‌توانید حساب خود را غیرفعال کنید': 'Cannot deactivate your own account',
  'نوع نامعتبر': 'Invalid type',
  'نیاز به سوپر ادمین': 'Superadmin required',
  'نیاز به ورود': 'Authentication required',
  'هدف ایجاد شد': 'Goal created',
  'هدف به‌روز شد': 'Goal updated',
  'هدف یافت نشد': 'Goal not found',
  'هیچ فیلدی برای بروزرسانی ارسال نشده است': 'No fields provided for update',
  'واریز ثبت شد — در صورت تکمیل، پیام سیستمی ارسال می‌شود':
    'Deposit recorded — a system message is sent when the goal is completed',
  'ورود موفق': 'Login successful',
  'ورودی نامعتبر': 'Invalid input',
  'ورودی نامعتبر — یکی از خطاهای زیر': 'Invalid input — one of the errors below',
  'وضعیت احراز هویت': 'Verification status',
  'وضعیت اشتراک': 'Subscription status',
  'وضعیت تخفیف فعلی کاربر': 'Current user discount status',
  'وضعیت مشاهده': 'Viewing status',
  'وضعیت نامعتبر': 'Invalid status',
  'پردازش انجام شد (با موفقیت یا با خطاهای ردیفی)':
    'Processing completed (with success or row-level errors)',
  'پلن انتخابی معتبر نیست': 'Selected plan is invalid',
  'پلن‌های موجود': 'Available plans',
  'پیام متعلق به کاربر دیگری است': 'Message belongs to another user',
  'پیام نخوانده قابل حذف نیست یا شناسه نامعتبر است': 'Unread message cannot be deleted or invalid ID',
  'پیام یافت نشد': 'Message not found',
  'پیشنهاد غیرفعال یا کاربر بدون اشتراک': 'Recommendation inactive or user has no subscription',
  'پیشنهاد یا کاربر یافت نشد': 'Recommendation or user not found',
  'پیشنهاد یافت نشد': 'Recommendation not found',
  'کاربر مورد نظر یافت نشد (target=user)': 'Target user not found (target=user)',
  'کاربر وارد سیستم نشده است': 'User not logged in',
  'کاربر یافت نشد': 'User not found',
  'کد با موفقیت تایید شد': 'Code verified successfully',
  'کد دعوت': 'Invite code',
  'کد دعوت با موفقیت ثبت شد': 'Invite code applied successfully',
  'کد دعوت یا کاربر یافت نشد': 'Invite code or user not found',
  'کد دعوت یافت نشد': 'Invite code not found',
  'کد قبلاً ثبت شده': 'Code already applied',
  'کد معتبر است': 'Code is valid',
  'کد معتبری یافت نشد': 'No valid code found',
  'کد وارد شده اشتباه است / کد منقضی شده است — لطفاً کد جدید درخواست کنید / این کد قبلاً استفاده شده است':
    'Incorrect or expired code — request a new code / code already used',
  'کلید عمومی': 'Public key',
  'کلیک با موفقیت ثبت شد — success: true': 'Click recorded successfully — success: true',
  'کپی موفق': 'Copy successful',
  'گروه یافت نشد': 'Group not found',
  'یافت نشد': 'Not found',
  'یک درخواست در حال بررسی برای این کاربر وجود دارد': 'A pending request already exists for this user',
};

const OP_DESCRIPTIONS = {
  'DELETE /api/admin/expert/recommendations/{id}':
    'Deletes the recommendation and all related `user_recommendation_status` rows.',
  'DELETE /api/admin/stories/{id}':
    'Deletes the story record and image file from disk.',
  'DELETE /api/avatar/custom':
    'Removes the current custom photo from disk and reverts the user avatar to the last selected seed (`avatar_last_seed`).',
  'DELETE /api/messages/{id}':
    'Only **read** messages can be deleted. Deleting an unread message returns 400.',
  'DELETE /api/profile/devices/{deviceId}':
    'Removes the device identified by `deviceId` from the connected devices list. Only devices belonging to the current user can be removed.',
  'DELETE /api/push/unsubscribe':
    'Removes the push subscription from the database for the specified endpoint (current user only). Typically called when the user disables notifications or the browser automatically cancels the subscription.',
  'DELETE /api/transactions/{id}':
    'The transaction is not physically deleted; only `is_deleted=1` is set and tag `usage_count` values are decremented.',
  'GET /api/admin/admins':
    'Superadmin only — `password_hash` is never returned.',
  'GET /api/admin/categories/requests':
    'Returns all category requests with requester user details; pending requests first.',
  'GET /api/admin/expert/recommendations/{id}/stats':
    'Returns pending/done/dismissed counts and a list of users who marked the recommendation as done.',
  'GET /api/admin/expert/recommendations/subscriber-count':
    'Used to show notification delivery progress when creating a new recommendation.',
  'GET /api/admin/referrals':
    'Returns all referral relationships for the admin panel. Names and mobile numbers are masked.',
  'GET /api/admin/referrals/stats':
    'Global referral statistics for the admin dashboard: total referral relationships, referrals leading to purchases, total discount percentage granted, and the top 10 inviters.',
  'GET /api/admin/stats/overview':
    'Users, verification, subscriptions, transactions, banners, and goals — from appDb + adminDb.',
  'GET /api/admin/stories':
    'Returns all stories ordered by `order_index` for the admin panel.',
  'GET /api/admin/subscriptions':
    'Returns all subscription requests with user details and current subscription status.',
  'GET /api/admin/verifications':
    'Returns all verification requests with user details, pending first. Requires `req.session.isAdmin === true`.',
  'GET /api/assets':
    'Calculates the Toman value of each asset from the market cache (Phase 8) or manual price. Creates a daily snapshot if 24 hours have passed.',
  'GET /api/assets/types':
    'Fixed list of asset types with `market_symbol` and `has_market_price`. Requires login; subscription not required.',
  'GET /api/avatar/list':
    'Returns all 40 avatars (20 free + 20 premium subscription) with the current user avatar and lock status for each. Before responding, checks subscription expiry so locks are real-time.',
  'GET /api/banners/active':
    'Banners where `is_active=1` and within the current date range. `impression_count` is incremented non-blocking.',
  'GET /api/categories':
    'System default categories plus the current user\'s approved custom categories. Results can be filtered with the `type` parameter.',
  'GET /api/categories/requests':
    'Returns all category requests submitted by the current user (pending, approved, rejected).',
  'GET /api/expert/recommendations':
    'Returns active recommendations with per-user status. Sorted: urgent → high → medium → low.',
  'GET /api/messages':
    'Returns the current user\'s messages. Before responding, expired messages (`expires_at < now`) are automatically marked as read to enforce the 7-day deletion rule from expiry.\n\nDisplay rules (applied in the same query):\n1) Only this user\'s messages\n2) Read messages older than 7 days since read are hidden\n3) Read messages older than 2 months are hidden\n4) Expired messages are shown but automatically marked as read.',
  'GET /api/profile':
    'Returns the current user\'s full profile with verification level and subscription status. Password is never returned.',
  'GET /api/profile/devices':
    'Returns devices logged into the account, ordered by most recent activity.',
  'GET /api/profile/invite-code':
    'Returns the user\'s unique invite code. Currently formatted as `DKHL-{userId}`.',
  'GET /api/push/vapid-public-key':
    'VAPID public key used by the frontend to create a browser push subscription. This endpoint is public (no login required). Returns 503 if keys are not configured on the server.',
  'GET /api/referral/discount':
    'Returns the user\'s active discount (only `invitee` type on this endpoint — inviter accumulated discount is returned via `GET /api/subscription/status` with key `pending_inviter_discounts`).\n\nInvitee discount is returned only if it has not been used and `expires_at` has not passed.',
  'GET /api/referral/my-invites':
    'Inviter panel — unique invite code, invite count, earned discounts (up to 5), total accumulated discount for next purchase, and list of invitees with masked names.',
  'GET /api/referral/validate/{code}':
    'Validates that the invite code matches the `DKHL-{userId}` pattern and the inviter exists in the database. This route is **callable without login** — the signup form calls it on invite code field `blur` to show the inviter\'s name.\n\nFor privacy, only the inviter\'s "first name + last name initial" is returned (e.g. "Ali M.").',
  'GET /api/split/public/{token}':
    'Shareable link for unregistered members. Returns personal balance when `mobile` query param is provided.',
  'GET /api/stories':
    'Returns active stories (`is_active = 1`) ordered by `order_index`. Requires user login.',
  'GET /api/stories/status':
    'Returns the current user\'s `has_seen_stories` flag so the frontend can decide whether to show stories.',
  'GET /api/subscription/plans':
    'Returns hardcoded subscription plans from the server. No login required (usable for guest display).',
  'GET /api/subscription/status':
    'Returns the user\'s current subscription, remaining days, and pending request (if any).',
  'GET /api/transactions':
    'Returns the user\'s transactions with pagination, filters by type/category/tag/date range/month, and text search. Output includes a summary (total income, total expense, balance) for the same filter scope. Default sort: transaction date (desc) then `created_at` (desc).',
  'GET /api/transactions/recurring':
    'Returns all transactions with `is_recurring=1` (and `is_deleted=0`) along with `next_expected` from the `recurring_alerts` table.',
  'GET /api/transactions/sample-csv':
    'Returns a CSV file with Persian column headers and sample rows for download. UTF-8 BOM is prepended so Excel opens Persian headers correctly.',
  'GET /api/transactions/summary':
    'Monthly financial summary: total income, total expense, balance, top 3 expense categories with percentages, and recurring transaction count. Also detects monthly subscriptions as `recurring_subscriptions`.',
  'GET /api/verification/status':
    'Returns the user\'s current verification level, pending request (if any), and history for each level.',
  'PATCH /api/admin/categories/defaults/{id}':
    'Updates name, icon, color, and `is_active` — type cannot be changed.',
  'PATCH /api/admin/categories/requests/{id}':
    'With `action=approve`, adds a custom category for the user and sends them a message. With `action=reject`, only the status changes to rejected.',
  'PATCH /api/admin/stories/{id}':
    'Updates `is_active` and/or `order_index`.',
  'PATCH /api/avatar/select':
    'Activates one avatar from the set of 40. Premium avatars require an active subscription. If a custom photo was set, its file is deleted when an avatar is selected.',
  'PATCH /api/messages/{id}/read':
    'Marks the specified message as read for the current user. Returns 403 if the message belongs to another user.',
  'PATCH /api/messages/read-all':
    'Marks all unread messages for the current user as read.',
  'PATCH /api/profile':
    'Updates user profile fields. Only submitted fields are changed. Some fields are locked based on verification level:\n\n- Email: always read-only\n- Mobile number and national ID: after verification level 1\n- Date of birth: after verification level 2\n- Address and postal code: after verification level 3',
  'PATCH /api/transactions/{id}':
    'Send only changed fields. Tag `usage_count` is adjusted based on diff. If `is_recurring` changes, the `recurring_alerts` record is synchronized.',
  'POST /api/admin/auth/change-password':
    'If `must_change_password=1`, `current_password` is not required. New password: minimum 8 characters, one uppercase letter, one digit, one special character.',
  'POST /api/admin/auth/login':
    'Creates an admin session (`dakhlyar_admin_sid`) with username and password. If `must_change_password=1`, the response includes `must_change: true`.',
  'POST /api/admin/auth/logout':
    'Destroys the admin session and logs the logout event in `admin_activity_log`.',
  'POST /api/admin/banners':
    'multipart/form-data — jpg/png/webp, max 3 MB',
  'POST /api/admin/expert/recommendations':
    'After INSERT, sends push and in-app messages to all users with active subscriptions (fire-and-forget).',
  'POST /api/admin/expert/send':
    'Resends an active recommendation to all subscribers or one specific user. Only users with `subscription_expires_at > now`.',
  'POST /api/admin/messages/send':
    'Sends a broadcast message (`target=all`) or direct message (`target=user`). Push notifications are sent non-blocking via `setImmediate`.',
  'POST /api/admin/stories/reset-for-users':
    'Sets `has_seen_stories` to 0 for all users so stories replay on next login.',
  'POST /api/admin/stories/upload':
    'Uploads a new story image from admin and saves it to the `stories` table. Allowed formats: jpg, jpeg, png, webp. Max file size: 5 MB. Currently protected by admin placeholder middleware (`req.session.isAdmin === true`) and will connect to admin login in phase 3.',
  'POST /api/admin/subscriptions/{id}/approve':
    'Approves the request, sets the user\'s `subscription_plan` and `subscription_expires_at` based on plan duration (expiry = today + `duration_months`), and sends a notification. This operation is atomic.',
  'POST /api/admin/subscriptions/{id}/reject':
    'Rejects the request; the user\'s current subscription is unchanged. Sends a notification (with optional reason).',
  'POST /api/admin/verifications/{id}/approve':
    'Approves the request, increases the user\'s verification level, and sends a notification. This operation is atomic.',
  'POST /api/admin/verifications/{id}/reject':
    'Rejects the request; the user\'s verification level is unchanged. Sends a notification (with reason).',
  'POST /api/auth/check-duplicates':
    'Checks whether mobile number, email, or national ID are already registered. Called on-blur while filling the signup form.',
  'POST /api/auth/forgot-password':
    'Receives the user\'s email, generates a `reset_password` OTP, and sends it by email.',
  'POST /api/auth/login':
    'Log in with mobile number and password. After 3 failed attempts within 10 minutes, the account is locked for 10 minutes.',
  'POST /api/auth/logout':
    'Destroys the user session on the server and clears the session cookie. Idempotent — succeeds even if not logged in.',
  'POST /api/auth/register':
    'Register a new user. Email OTP (type signup) must be verified first; otherwise returns 403.',
  'POST /api/auth/reset-password':
    'After `reset_password` OTP verification, sets the user\'s new password.',
  'POST /api/auth/send-otp':
    'Generates a random 6-digit code and emails it to the user. Code is valid for 180 seconds. Previous unused codes of the same type for this user are automatically invalidated.',
  'POST /api/auth/verify-otp':
    'Verifies the 6-digit code sent to email. On success, sets session flag `otp_verified_email` so the user can complete signup/password reset.',
  'POST /api/avatar/upload':
    'Uploads a custom photo (jpg/png/webp, max 3 MB) as the user avatar. Available only for users with active subscriptions. If a previous photo exists, its file is deleted from disk. Stored filename is built from userId and timestamp only (not the uploaded filename) to prevent path traversal.',
  'POST /api/categories/request':
    'User proposes a custom category; admin approves or rejects it. User cannot have multiple pending requests with the same name.',
  'POST /api/profile/change-password':
    'Changes the user password. New password must meet complexity rules and cannot match the current password.',
  'POST /api/push/subscribe':
    'Creates or updates the user\'s push subscription in the database. If the same endpoint was already registered, it is updated to the new user_id and keys (INSERT OR REPLACE with endpoint as unique key).',
  'POST /api/referral/apply':
    'After successful `POST /api/auth/register` and receiving `user_id`, the signup form calls this route with the new user ID and valid invite code.\n\n- This route is **callable without session** (login has not occurred yet).\n- Invite code can only be applied at this moment — the user cannot add one later.\n- If the inviter had an active subscription at signup, a `referral_discounts` record (source = `invitee`) valid for 10 days from signup is created for the invitee. This discount is applied to `final_price` when admin approves purchase.\n- Inviter reward is calculated and granted when the invitee\'s **purchase is approved** (up to 5 successful invites).',
  'POST /api/split/groups/{id}/members':
    'Group creator only. If mobile exists in users → `is_registered=1`.',
  'POST /api/split/groups/{id}/settle':
    'With `create_transaction=true`, records an expense transaction for the logged-in user (`from_member`).',
  'POST /api/stories/mark-seen':
    'After the user views the last story, sets the user\'s `has_seen_stories` flag to 1. Called without a request body.',
  'POST /api/subscription/request':
    'Submits a subscription purchase request. Price is always read from server PLANS; client-submitted price is not accepted.',
  'POST /api/transactions':
    'Records an income or expense transaction. Amount is always stored as a positive integer (Toman). Category must be default or user-owned (approved) and its type (income/expense/both) must match transaction type. Tags sent as array, max 5 tags, 20 characters each. `transaction_date` can be Gregorian or Jalali (YYYY-MM-DD); server auto-detects. Recurring transactions require `recurring_interval`.',
  'POST /api/transactions/bulk-delete':
    'Accepts a list of IDs and soft-deletes only those belonging to the user. Invalid/other users\' IDs are excluded from the final count.',
  'POST /api/transactions/import':
    'Accepts CSV or Excel (xlsx/xls) with Persian column headers. Max 2 MB. For Excel, the first sheet is processed. Dates written as Jalali YYYY-MM-DD are auto-converted to Gregorian. If category name is not found, default "Miscellaneous" is used and returned in warnings. Invalid rows are listed in errors but never cause the entire request to return 500.',
  'POST /api/verification/request':
    'User can request only the next level (`current_level + 1`). Request is accepted only if required profile fields are complete and no other pending request exists.',
};

// Collect response descriptions from spec
const responseDescs = new Set();
const opDescsFromSpec = [];

for (const [pathKey, pathObj] of Object.entries(spec.paths)) {
  for (const [method, op] of Object.entries(pathObj)) {
    if (op && op.description) {
      opDescsFromSpec.push({ key: `${method.toUpperCase()} ${pathKey}`, fa: op.description });
    }
    if (op && op.responses) {
      for (const resp of Object.values(op.responses)) {
        if (resp && resp.description) responseDescs.add(resp.description);
      }
    }
  }
}

// Verify completeness
const missingResponses = [...responseDescs].filter((s) => !RESPONSE_PHRASES[s]);
const missingOps = opDescsFromSpec.filter((o) => !OP_DESCRIPTIONS[o.key]);

if (missingResponses.length) {
  console.error('Missing response translations:', missingResponses);
  process.exit(1);
}
if (missingOps.length) {
  console.error('Missing operation translations:', missingOps.map((o) => o.key));
  process.exit(1);
}

function writeModule(filePath, entries) {
  const lines = ["'use strict';", '', 'module.exports = {'];
  for (const [key, value] of entries) {
    lines.push(`  ${JSON.stringify(key)}: ${JSON.stringify(value)},`);
  }
  lines.push('};', '');
  fs.writeFileSync(filePath, lines.join('\n'), 'utf8');
}

const responseEntries = [...responseDescs].sort((a, b) => a.localeCompare(b, 'fa')).map((k) => [k, RESPONSE_PHRASES[k]]);
const opEntries = opDescsFromSpec.sort((a, b) => a.key.localeCompare(b.key)).map((o) => [o.key, OP_DESCRIPTIONS[o.key]]);

writeModule(OUT_RESPONSES, responseEntries);
writeModule(OUT_OPS, opEntries);

console.log(`Wrote ${OUT_RESPONSES} (${responseEntries.length} entries)`);
console.log(`Wrote ${OUT_OPS} (${opEntries.length} entries)`);
