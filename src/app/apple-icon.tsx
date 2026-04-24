import { ImageResponse } from 'next/og';

export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#1e3a5f',
        }}
      >
        <div
          style={{
            fontSize: 90,
            fontWeight: 900,
            color: '#f0c040',
            lineHeight: 1,
          }}
        >
          A
        </div>
        <div
          style={{
            fontSize: 28,
            fontWeight: 700,
            color: '#93c5fd',
            letterSpacing: '4px',
            marginTop: '-6px',
          }}
        >
          PREP
        </div>
      </div>
    ),
    { ...size },
  );
}
