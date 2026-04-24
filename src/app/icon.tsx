import { ImageResponse } from 'next/og';

export const size = { width: 512, height: 512 };
export const contentType = 'image/png';

export default function Icon() {
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
          borderRadius: '80px',
        }}
      >
        <div
          style={{
            fontSize: 260,
            fontWeight: 900,
            color: '#f0c040',
            lineHeight: 1,
            letterSpacing: '-8px',
          }}
        >
          A
        </div>
        <div
          style={{
            fontSize: 80,
            fontWeight: 700,
            color: '#93c5fd',
            letterSpacing: '12px',
            marginTop: '-16px',
          }}
        >
          PREP
        </div>
      </div>
    ),
    { ...size },
  );
}
