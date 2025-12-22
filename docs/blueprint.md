# **App Name**: PhotoBooker

## Core Features:

- User Authentication: Allow users to create accounts, log in, and manage their profiles to store and access their photo albums.
- Landing Page: Attractive landing page to engage user.
- Photo Upload: Enable users to upload photos from their local devices or connect to Google Photos to import images.
- Dummy Photo Generation: Implement a mode to fetch approximately 100 dummy images from `https://picsum.photos/seed/${Math.random().toString(36)}/800/800` for rapid album prototyping and testing.
- Album Layout Configuration: Provide tools for users to configure album details, including the size of the first and last single pages (e.g., 20x20 cm), number of double pages, and photos per page.
- AI-Powered Album Enhancement Tool: Integrate a generative AI tool to intelligently analyze and automatically enhance photos within the album, suggest optimal layouts based on image content, and provide personalized style recommendations. This includes reasoning about what adjustments might make certain photos 'pop' as part of the layout.
- Print Preview: Implement a realistic, interactive preview of the photobook that simulates a physical book, allowing users to 'flip' through the pages and view the final printed output.

## Style Guidelines:

- Primary color: Deep purple (#673AB7), suggesting creativity and sophistication.
- Background color: Very light purple (#F3E5F5), almost white to ensure focus remains on the images.
- Accent color: A soft rose (#E91E63) is employed to highlight interactive elements, drawing users' eyes with its distinct vibrancy.
- Body and headline font: 'Alegreya', a serif typeface, provides elegance and readability suitable for viewing the photobook's text and descriptions.
- Utilize minimalist icons for album controls (upload, preview, save) and user actions (profile, settings).
- Employ a clean, grid-based layout for photo presentation and album configuration options.
- Incorporate subtle animations for page transitions in the print preview mode and for loading states during photo uploads.