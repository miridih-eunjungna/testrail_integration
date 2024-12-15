import dotenv from 'dotenv';
import axios from 'axios';

// 환경 변수 로드
dotenv.config();

// 환경 변수 출력 (디버깅용)
console.log('TESTRAIL_API_KEY:', process.env.TESTRAIL_API_KEY);
console.log('TESTRAIL_USER:', process.env.TESTRAIL_USER);
console.log('TESTRAIL_URL:', process.env.TESTRAIL_URL);
console.log('SLACK_WEBHOOK_URL:', process.env.SLACK_WEBHOOK_URL);


// Base64로 사용자 인증 정보 인코딩
const credentials = `${process.env.TESTRAIL_USER}:${process.env.TESTRAIL_API_KEY}`;
const base64Credentials = Buffer.from(credentials).toString('base64');

// Slack 메시지 전송 함수
const sendToSlack = async (testRunDetails, failedComments) => {
  try {
    const slackMessage = {
      text: `Test Run Details:\n
             Name: ${testRunDetails.name}\n
             Passed: ${testRunDetails.passed_count}\n
             Failed: ${testRunDetails.failed_count}\n
             Blocked: ${testRunDetails.blocked_count}\n
             URL: ${testRunDetails.url}\n
             ${failedComments ? `Failed Comments:\n${failedComments}` : ''}`
    };

    // Slack Webhook을 사용하여 메시지 전송
    await axios.post(process.env.SLACK_WEBHOOK_URL, slackMessage);
    console.log('Message sent to Slack');
  } catch (error) {
    console.error('Error sending message to Slack:', error);
  }
};

// TestRail API에서 실행 정보 가져오기
const getTestRunDetails = async (runId) => {
  try {
    const url = `${process.env.TESTRAIL_URL}/get_run/${runId}`;
    const response = await axios.get(url, {
      headers: {
        Authorization: `Basic ${base64Credentials}`,
        'Content-Type': 'application/json',
      },
    });

    console.log('Test Run Details:', response.data);

    // 실패한 테스트 케이스에 대한 코멘트 가져오기
    const failedComments = await getFailedTestComments(runId);

    // Slack으로 정보 전송
    sendToSlack(response.data, failedComments);
  } catch (error) {
    console.error('Error fetching test run details:', error.response?.data || error.message);
  }
};
// TestRail API에서 실패한 테스트 케이스의 코멘트 가져오기
const getFailedTestComments = async (runId) => {
  try {
    const url = `${process.env.TESTRAIL_URL}/get_tests/${runId}`;
    const response = await axios.get(url, {
      headers: {
        Authorization: `Basic ${base64Credentials}`,
        'Content-Type': 'application/json',
      },
    });

    console.log('Response Data:', response.data); // 응답 데이터 확인

    const tests = response.data.tests || [];
    console.log('Tests:', tests); // tests 배열 확인

    const failedTests = tests.filter(test => test.status_id === 5);
    console.log('Failed Tests:', failedTests); // 실패한 테스트 확인

    if (failedTests.length > 0) {
      console.log('Failed Test Comments:', failedTests.map(test => test.comment).join('\n'));
    } else {
      console.log('No failed tests found.');
    }

    const failedComments = failedTests.map(test => test.comment).join('\n') || 'No failed test comments.';
    return failedComments;
  } catch (error) {
    console.error('Error fetching failed test comments:', error.response?.data || error.message);
    return 'Error fetching failed test comments.';
  }
};

// 특정 테스트 실행 정보 가져오기 (runId는 92로 설정)
getTestRunDetails(87);
