class ConstantHelper {
    public static readonly mailConstants = {
        // Emails
        firstEmail: process.env.FIRST_EMAIL,
        secondEmail: process.env.INFO_EMAIL,
        thirdEmail: process.env.SUPPORT_EMAIL,
        supportEmail: process.env.SUPPORT_EMAIL,

        // Website & Branding
        appLink: process.env.APP_LINK,
        appLogo: process.env.APP_LOGO,

        // Phone Numbers
        firstPhoneNumber: process.env.FIRST_PHONE_NUMBER,
        secondPhoneNumber: process.env.SECOND_PHONE_NUMBER,
        firstPhoneLink: process.env.FIRST_PHONE_LINK,
        secondPhoneLink: process.env.SECOND_PHONE_LINK,
        supportPhone: process.env.SUPPORT_PHONE,

        // Office Addresses
        firstOfficeAddress: process.env.FIRST_OFFICE_ADDRESS,
        secondOfficeAddress: process.env.SECOND_OFFICE_ADDRESS,
        officeAddress: process.env.OFFICE_ADDRESS,

        // Social Media
        facebookLink: process.env.FACEBOOK_LINK,
        facebookLogo: process.env.FACEBOOK_LOGO,
        twitterLink: process.env.TWITTER_LINK,
        twitterLogo: process.env.TWITTER_LOGO,
        instagramLink: process.env.INSTAGRAM_LINK,
        instagramLogo: process.env.INSTAGRAM_LOGO,
        youtubeLink: process.env.YOUTUBE_LINK,
        youtubeLogo: process.env.YOUTUBE_LOGO,
        linkedinLink: process.env.LINKEDIN_LINK,
        linkedinLogo: process.env.LINKEDIN_LOGO,

        // Other
        unsubscribeLink: process.env.UNSUBSCRIBE_LINK,
    };

    public static get socialLinks() {
        const { mailConstants: c } = this;

        return [
            { name: "Facebook", link: c.facebookLink, icon: c.facebookLogo },
            { name: "Twitter", link: c.twitterLink, icon: c.twitterLogo },
            { name: "Instagram", link: c.instagramLink, icon: c.instagramLogo },
            { name: "YouTube", link: c.youtubeLink, icon: c.youtubeLogo },
            { name: "LinkedIn", link: c.linkedinLink, icon: c.linkedinLogo },
        ];
    }

    public static readonly exampleTicketTemplate = `
    <!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Your Ticket</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background: #f7f7f7;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding: 2rem 0;">
    <tr>
      <td align="center">
        <table width="400" cellpadding="0" cellspacing="0" style="background: #fff; border-radius: 8px; box-shadow: 0 4px 8px rgba(0,0,0,0.1); overflow: hidden;">
          <tr>
            <td style="padding: 1.5rem; background: #2c3e50; color: #fff; text-align: center;">
              <h2 style="margin: 0; font-size: 24px;">Your Event Ticket</h2>
            </td>
          </tr>

          <tr>
            <td style="padding: 1.5rem;">
              <p style="margin: 0 0 1rem;">Hello <strong>{{name}}</strong>,</p>
              <p style="margin: 0 0 1rem;">Thanks for registering! Below is your ticket barcode:</p>

              <div style="text-align: center; margin: 2rem 0;">
                <img src="{{qrCodeUrl}}" alt="Ticket Barcode" style="width: 80%; max-width: 150px;" />
              </div>

              <p style="font-size: 0.9rem; color: #7f8c8d; text-align: center;">
                Please bring this ticket or show it on your phone at the entrance.
              </p>
            </td>
          </tr>

          <tr>
            <td style="padding: 1rem; background: #ecf0f1; text-align: center;">
              <small style="color: #95a5a6;">&copy; 2025 MediaCraft. All rights reserved.</small>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`
}

export { ConstantHelper }