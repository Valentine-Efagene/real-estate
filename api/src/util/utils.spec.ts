import AwsUtil from './AwsUtil';


describe('UTILS', () => {
    describe('AwsUtils', () => {
        it('should return "Hello World!"', () => {
            const url = 'https://${bucket}.s3.${region}.amazonaws.com/${key}'
            expect(AwsUtil.getKeyFromUrl(url)).toBe('${key}');
        });

        it('should return developer/document/bf54018d-ceb5-4396-8466-0d6c63fe6aff-20240115T084604686Z..png"', () => {
            const url = 'https://qshelter-public.s3.amazonaws.com/developer/document/bf54018d-ceb5-4396-8466-0d6c63fe6aff-20240115T084604686Z..png'
            expect(AwsUtil.getKeyFromUrl(url)).toBe('developer/document/bf54018d-ceb5-4396-8466-0d6c63fe6aff-20240115T084604686Z..png');
        });
    });
});
