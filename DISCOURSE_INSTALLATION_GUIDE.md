# Discourse Installation Guide for Commonry

This guide walks you through installing Discourse to work with your Commonry integration.

## 📋 Table of Contents

- [Installation Options](#installation-options)
- [Prerequisites](#prerequisites)
- [Recommended: Docker Installation](#recommended-docker-installation)
- [DNS and Domain Setup](#dns-and-domain-setup)
- [Post-Installation Configuration](#post-installation-configuration)
- [Configure SSO with Commonry](#configure-sso-with-commonry)
- [Troubleshooting](#troubleshooting)
- [Alternative Installation Methods](#alternative-installation-methods)

---

## 🎯 Installation Options

### Option 1: Self-Hosted (Docker) ⭐ **Recommended**

- **Pros**: Full control, free hosting (except server costs), easy updates
- **Cons**: Requires server management knowledge
- **Cost**: Server costs only (~$10-40/month depending on traffic)
- **Best for**: Technical users, cost-conscious projects

### Option 2: Managed Discourse Hosting

- **Pros**: Zero maintenance, professional support, automatic updates
- **Cons**: Monthly subscription fee
- **Cost**: $100+/month
- **Best for**: Non-technical teams, mission-critical forums
- **URL**: https://www.discourse.org/pricing

### Option 3: Digital Ocean One-Click

- **Pros**: Fast setup, managed infrastructure
- **Cons**: Less customization than Docker
- **Cost**: $12+/month
- **Best for**: Quick start with some managed support

---

## ✅ Prerequisites

Before installing Discourse, ensure you have:

### Required:

- ✅ **A server** with:
  - **2 GB RAM minimum** (4 GB+ recommended for production)
  - **2 CPU cores minimum**
  - **40 GB disk space minimum**
  - **Ubuntu 20.04 or 22.04 LTS** (other Linux distros work but Ubuntu is best supported)
  - **Root or sudo access**

- ✅ **A domain name**: `forum.commonry.app` (or your chosen subdomain)

- ✅ **Email service**: For sending notifications and verification emails
  - Can use: Gmail, SendGrid, Mailgun, Amazon SES, etc.
  - **Important**: Same email service can be shared with Commonry

- ✅ **HTTPS support**: Required for production
  - Discourse installer includes Let's Encrypt automatic SSL

### Recommended Server Providers:

| Provider          | Plan                  | Cost        | Notes                  |
| ----------------- | --------------------- | ----------- | ---------------------- |
| **DigitalOcean**  | Basic Droplet (2 GB)  | $12/month   | Best for beginners     |
| **Linode**        | Nanode (4 GB)         | $24/month   | Excellent performance  |
| **AWS Lightsail** | 2 GB instance         | $10/month   | Good AWS integration   |
| **Hetzner**       | CX21                  | €5.83/month | Best price/performance |
| **Vultr**         | High Frequency (2 GB) | $12/month   | Good global locations  |

---

## 🚀 Recommended: Docker Installation

This is the **official Discourse installation method** and what we'll focus on.

### Step 1: Provision Your Server

#### Using DigitalOcean (Example):

1. **Create a new Droplet**:

   ```
   - Image: Ubuntu 22.04 LTS
   - Plan: Basic (2 GB RAM / 2 CPUs)
   - Datacenter: Choose closest to your users
   - Authentication: SSH key (recommended) or password
   ```

2. **Note your server's IP address**: e.g., `167.99.123.45`

3. **SSH into your server**:
   ```bash
   ssh root@167.99.123.45
   ```

### Step 2: Update System Packages

```bash
# Update package list
sudo apt update

# Upgrade packages
sudo apt upgrade -y

# Install required tools
sudo apt install -y git
```

### Step 3: Configure Swap (If RAM < 4 GB)

If your server has less than 4 GB RAM, create swap space:

```bash
# Create 2 GB swap file
sudo install -o root -g root -m 0600 /dev/null /swapfile
sudo dd if=/dev/zero of=/swapfile bs=1M count=2048
sudo mkswap /swapfile
sudo swapon /swapfile

# Make swap permanent
echo '/swapfile swap swap defaults 0 0' | sudo tee -a /etc/fstab

# Verify swap is active
free -h
```

### Step 4: Install Docker

Discourse uses Docker for easy deployment and updates:

```bash
# Install Docker using official script
wget -qO- https://get.docker.com/ | sh

# Add current user to docker group (if not root)
sudo usermod -aG docker $USER

# Verify Docker installation
docker --version
```

### Step 5: Download Discourse

```bash
# Create directory for Discourse
sudo mkdir -p /var/discourse

# Clone official Discourse Docker repository
sudo git clone https://github.com/discourse/discourse_docker.git /var/discourse

# Navigate to Discourse directory
cd /var/discourse
```

### Step 6: Run Installation Wizard

```bash
# Launch the interactive setup wizard
sudo ./discourse-setup
```

The wizard will ask you several questions:

#### Configuration Questions:

**1. Hostname for your Discourse?**

```
forum.commonry.app
```

**2. Email address for admin account?**

```
your-email@example.com
```

_This will be your admin login email_

**3. SMTP server address?**

Choose based on your email provider:

**For Gmail:**

```
smtp.gmail.com
```

**For SendGrid:**

```
smtp.sendgrid.net
```

**For Mailgun:**

```
smtp.mailgun.org
```

**For Amazon SES (us-east-1):**

```
email-smtp.us-east-1.amazonaws.com
```

**4. SMTP port?**

```
587
```

_Use 587 for TLS (most common)_

**5. SMTP user name?**

**For Gmail:**

```
your-email@gmail.com
```

**For SendGrid:**

```
apikey
```

**For Mailgun:**

```
postmaster@your-domain.mailgun.org
```

**For Amazon SES:**

```
Your AWS SMTP username
```

**6. SMTP password?**

**For Gmail:**

- Use an **App Password** (not your regular password)
- Generate at: https://myaccount.google.com/apppasswords
- Enter the 16-character app password

**For SendGrid:**

- Use your SendGrid API key

**For Mailgun:**

- Use your Mailgun SMTP password

**For Amazon SES:**

- Use your AWS SMTP password

**7. Let's Encrypt account email?**

```
your-email@example.com
```

_For SSL certificate notifications_

**8. Optional Maxmind License key?**

```
(Press Enter to skip - not needed)
```

### Step 7: Complete Installation

After answering questions, the installer will:

1. Generate configuration file (`app.yml`)
2. Download Docker images
3. Bootstrap Discourse
4. Start the application

**This takes 10-20 minutes**. You'll see:

```
Pups Successfully Completed!
Discourse launched!
```

### Step 8: Verify Installation

Once complete, visit your domain:

```
https://forum.commonry.app
```

You should see the Discourse setup wizard!

---

## 🌐 DNS and Domain Setup

**Before visiting your forum, configure DNS:**

### Add DNS Records:

In your domain registrar (e.g., Cloudflare, Namecheap, GoDaddy):

**Create an A record:**

```
Type: A
Name: forum
Value: 167.99.123.45  (your server IP)
TTL: 300 (or Auto)
```

**Alternatively, if using subdomain:**

```
Type: CNAME
Name: forum
Value: commonry.app
```

**Verify DNS propagation:**

```bash
# Check if DNS is resolving
dig forum.commonry.app

# Or use online tool
# https://www.whatsmydns.net/#A/forum.commonry.app
```

DNS can take 5 minutes to 48 hours to propagate (usually 5-30 minutes).

---

## ⚙️ Post-Installation Configuration

### Step 1: Complete Discourse Setup Wizard

1. Visit `https://forum.commonry.app`

2. **Create admin account**:
   - This uses the email you provided during setup
   - Check your email for confirmation
   - Click the confirmation link

3. **Complete setup wizard**:
   - Site name: `Commonry Community`
   - Site description: `A commons for lifelong learners`
   - Contact email: Your support email
   - Choose a color scheme (can match Commonry's cyan theme)

### Step 2: Basic Settings

Navigate to **Admin → Settings**:

#### Required Settings:

**1. Site Settings** (`/admin/site_settings/category/required`):

- ✅ `title`: "Commonry Community"
- ✅ `site_description`: "A commons for lifelong learning"
- ✅ `contact_email`: your support email
- ✅ `notification_email`: your no-reply email

**2. Login Settings** (`/admin/site_settings/category/login`):

- ⚠️ **Don't configure SSO yet** - we'll do that in the next section

**3. Email Settings**:

- Already configured during installation
- Test by: Admin → Emails → Send Test Email

### Step 3: Create Categories

Create initial forum categories:

**Admin → Categories → + New Category**

Suggested categories for Commonry:

- 📚 **Learning Strategies** - Study techniques and methods
- 🎯 **Spaced Repetition** - SRS tips and discussions
- 💬 **General Discussion** - Community chat
- 🆘 **Support** - Help and troubleshooting
- 📢 **Announcements** - Official updates

### Step 4: Customize Appearance

**Admin → Customize → Themes**

To match Commonry's design:

1. **Color Scheme**:
   - Primary: `#0ea5e9` (Cyan - matches Commonry)
   - Secondary: `#0d1117` (Dark background)
   - Tertiary: `#fbbf24` (Amber accent)

2. **Upload Logo** (if you have one):
   - Admin → Settings → Files → logo
   - Recommended size: 250x50px

---

## 🔐 Configure SSO with Commonry

Now connect Discourse to your Commonry authentication system.

### Step 1: Generate SSO Secret

On your **Commonry server**, generate a secure secret:

```bash
openssl rand -hex 32
```

**Example output:**

```
a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456
```

**Save this secret** - you'll use it in both Discourse and Commonry.

### Step 2: Configure Discourse for SSO

1. **Navigate to**: Admin → Settings → Login

2. **Enable DiscourseConnect**:

   ```
   enable_discourse_connect = ✅ true
   ```

3. **Set SSO URL**:

   ```
   discourse_connect_url = https://commonry.app/api/discourse/sso
   ```

   _Replace with your actual Commonry domain_

4. **Set SSO Secret**:

   ```
   discourse_connect_secret = a1b2c3d4e5f6...  (the secret you generated)
   ```

5. **Optional - Override Settings**:

   ```
   discourse_connect_overrides_avatar = true
   discourse_connect_overrides_email = false
   discourse_connect_overrides_username = false
   discourse_connect_overrides_name = true
   ```

6. **Disable other login methods** (recommended):

   ```
   enable_local_logins = false
   enable_google_oauth2_logins = false
   enable_github_logins = false
   ```

7. **Click "Save Changes"**

### Step 3: Configure Commonry

Add to your Commonry `.env` file:

```bash
# Discourse SSO Configuration
DISCOURSE_SSO_SECRET=a1b2c3d4e5f6...  (same secret as Discourse)
DISCOURSE_URL=https://forum.commonry.app

# Frontend variables
VITE_DISCOURSE_URL=https://forum.commonry.app
VITE_API_URL=https://commonry.app  (your Commonry domain)
```

### Step 4: Restart Commonry Backend

```bash
# Restart your Commonry server to load new environment variables
pm2 restart commonry  # or however you run it
# or
node server.js
```

### Step 5: Test SSO Integration

1. **Log in to Commonry** (https://commonry.app)
2. **Navigate to "The Square"**
3. **Click "Enter Forum" button**
4. **Should redirect to Discourse and auto-login** ✅

If it works - congratulations! SSO is configured!

### Step 6: Test User Registration Flow

1. **Create a new Commonry account**
2. **Verify email in Commonry**
3. **Go to The Square → Enter Forum**
4. **Should create Discourse account automatically**

---

## 🐛 Troubleshooting

### Issue: "Connection Refused" when visiting forum

**Cause**: Discourse not running or firewall blocking

**Solution**:

```bash
# Check if Discourse is running
cd /var/discourse
sudo ./launcher status app

# If not running, start it
sudo ./launcher start app

# Check firewall
sudo ufw status
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
```

### Issue: "SSL Certificate Error"

**Cause**: Let's Encrypt SSL not properly configured

**Solution**:

```bash
# Rebuild Discourse with SSL
cd /var/discourse
sudo ./launcher rebuild app
```

### Issue: "Can't send emails"

**Cause**: SMTP configuration incorrect

**Solution**:

```bash
# Edit configuration
cd /var/discourse
sudo nano containers/app.yml

# Find SMTP settings, verify they're correct
# Then rebuild
sudo ./launcher rebuild app
```

### Issue: "SSO signature invalid"

**Cause**: Secret mismatch between Discourse and Commonry

**Solution**:

1. Verify `DISCOURSE_SSO_SECRET` in Commonry `.env` matches `discourse_connect_secret` in Discourse
2. Check for extra whitespace
3. Restart both services

### Issue: "Email must be verified before accessing forum"

**Cause**: User hasn't verified email in Commonry (expected behavior)

**Solution**: User must verify their Commonry email first

---

## 🔄 Updating Discourse

Discourse releases updates regularly. To update:

```bash
cd /var/discourse

# Pull latest changes
sudo git pull

# Rebuild (this updates Discourse)
sudo ./launcher rebuild app
```

**Frequency**: Update monthly or when security updates are released

---

## 📊 Monitoring and Maintenance

### View Logs

```bash
cd /var/discourse

# View real-time logs
sudo ./launcher logs app

# View recent logs
sudo ./launcher logs app --tail 100
```

### Check Resource Usage

```bash
# Memory and CPU
htop

# Disk space
df -h

# Docker stats
docker stats
```

### Backup

**Discourse has built-in backups:**

1. **Admin → Backups**
2. **Take Backup Now**
3. **Download backup** to your local machine

**Automated backups:**

- Admin → Settings → Backups
- `backup_frequency`: 1 (daily)
- `maximum_backups`: 7 (keep 7 days)

---

## 🌟 Alternative Installation Methods

### Option 1: DigitalOcean One-Click

1. Log in to DigitalOcean
2. **Create → Droplets**
3. **Marketplace → Discourse**
4. Choose size (2 GB minimum)
5. Create Droplet
6. Follow post-creation instructions

### Option 2: AWS EC2

1. Launch Ubuntu 22.04 instance (t3.small minimum)
2. Follow Docker installation steps above
3. Configure security group:
   - Allow ports 80, 443, 22

### Option 3: Managed Hosting

Skip server management entirely:

**Discourse Hosting**: https://www.discourse.org/pricing

- Starting at $100/month
- Includes hosting, updates, backups, support

---

## 📚 Additional Resources

- **Official Discourse Install Guide**: https://github.com/discourse/discourse/blob/main/docs/INSTALL-cloud.md
- **Discourse Meta Forum**: https://meta.discourse.org/
- **SSO Configuration**: https://meta.discourse.org/t/discourseconnect-official-single-sign-on-for-discourse-sso/13045
- **Email Setup Guides**: https://meta.discourse.org/t/how-to-set-up-email/68
- **Performance Tuning**: https://meta.discourse.org/t/tuning-ruby-and-postgresql-parameters-for-discourse/27176

---

## ✅ Installation Checklist

- [ ] Server provisioned (2+ GB RAM, Ubuntu 22.04)
- [ ] Docker installed
- [ ] Discourse cloned and setup wizard completed
- [ ] DNS configured (A record pointing to server)
- [ ] HTTPS working (Let's Encrypt certificate)
- [ ] Email sending configured and tested
- [ ] Admin account created
- [ ] Categories created
- [ ] SSO configured with Commonry
- [ ] SSO tested and working
- [ ] Backups enabled
- [ ] Monitoring set up

---

**Installation Time**: ~1-2 hours for first-time setup

**Need Help?** Check the troubleshooting section or ask on Discourse Meta!

Good luck with your installation! 🚀
