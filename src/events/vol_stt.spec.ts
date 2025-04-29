import * as fs from 'fs';
import { AsrWsClient, convertAudioBuffer } from './vol_stt';

describe('transform audio', () => {
  it('should transform audio', async () => {
    const audio = fs.readFileSync(
      './audio/0340f481-4afd-4059-9719-2533d3db38b6.mp4',
    );
    console.log('audio----', audio);
    const wavBuffer = (await convertAudioBuffer(audio, {
      inputFormat: 'mp4',
      outputFormat: 'wav',
    })) as Buffer;
    console.log('wavBuffer----', wavBuffer?.length);
  });

  it('should reconize audio2', async () => {
    const audio = fs.readFileSync(
      './audio/test.wav',
    );
    console.log('audio----', audio);
    const client = new AsrWsClient('volcengine_streaming_common', {
      token: 'xxxxx',
      appid: 'xxxxxx',
      cluster: 'volcengine_streaming_common',
      format: 'wav'    });
    await new Promise((resolve, reject) => {
      setTimeout(() => resolve(null), 1000);
    });
    client.execute(audio);
    await new Promise((resolve, reject) => {
      setTimeout(() => resolve(null), 5000);
    });
  }, 10000);
});
